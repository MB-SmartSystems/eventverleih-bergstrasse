/**
 * PayPal Orders v2 — Bestellung erstellen / abrufen / einziehen (capture).
 *
 * Ablauf (analog Stripe-Payment-Link, aber PayPal):
 *   1. createOrder(...) → Order mit intent=CAPTURE, liefert approveUrl (PayPal-Zahlseite).
 *   2. Kunde bestaetigt auf PayPal → Redirect auf unseren return_url.
 *   3. captureOrder(orderId) → Geld wird eingezogen (aufs Business-Konto).
 *   4. Webhook PAYMENT.CAPTURE.COMPLETED → Baserow-Update (idempotent).
 *
 * `custom_id` = "<buchungId>:<type>" transportiert das Routing bis in den Webhook,
 * sodass wir dort ohne eigene Order-Ablage die Buchung + Zahlungsart kennen.
 */
import { paypalFetch, getPayPalWebhookId } from "./client";

export type PayPalPaymentType = "anzahlung" | "restzahlung" | "komplettzahlung";

const DESC: Record<PayPalPaymentType, string> = {
  anzahlung: "Anzahlung",
  restzahlung: "Restzahlung",
  komplettzahlung: "Komplettzahlung (Miete)",
};

interface CreateOrderParams {
  buchungId: number;
  paymentType: PayPalPaymentType;
  amountEur: number;
  returnUrl: string;
  cancelUrl: string;
  description?: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

export async function createOrder(params: CreateOrderParams): Promise<{ orderId: string; approveUrl: string }> {
  const value = params.amountEur.toFixed(2);
  if (Number(value) <= 0) throw new Error(`Invalid amount: ${params.amountEur}`);

  const order = await paypalFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `B${params.buchungId}-${params.paymentType}`,
          custom_id: `${params.buchungId}:${params.paymentType}`,
          description:
            params.description ||
            `Eventverleih Bergstraße — ${DESC[params.paymentType]} Buchung #${params.buchungId}`,
          amount: { currency_code: "EUR", value },
        },
      ],
      application_context: {
        brand_name: "Eventverleih Bergstraße",
        locale: "de-DE",
        landing_page: "NO_PREFERENCE",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    },
  });

  const approve = order.links?.find((l) => l.rel === "approve")?.href;
  if (!approve) {
    throw new Error(`PayPal-Order ${order.id} ohne approve-Link (status=${order.status})`);
  }
  return { orderId: order.id, approveUrl: approve };
}

export interface PayPalCaptureResult {
  orderId: string;
  status: string;
  captureId: string | null;
  amountEur: number;
  buchungId: number | null;
  paymentType: PayPalPaymentType | null;
  alreadyCaptured: boolean;
}

function parseCustomId(custom: string | undefined): { buchungId: number | null; paymentType: PayPalPaymentType | null } {
  if (!custom) return { buchungId: null, paymentType: null };
  const [idRaw, typeRaw] = custom.split(":");
  const buchungId = parseInt(idRaw || "", 10) || null;
  const paymentType =
    typeRaw === "anzahlung" || typeRaw === "restzahlung" || typeRaw === "komplettzahlung"
      ? (typeRaw as PayPalPaymentType)
      : null;
  return { buchungId, paymentType };
}

export async function getOrder(orderId: string): Promise<PayPalCaptureResult> {
  const order = await paypalFetch<{
    id: string;
    status: string;
    purchase_units?: Array<{
      custom_id?: string;
      amount?: { value?: string };
      payments?: { captures?: Array<{ id: string; amount?: { value?: string }; status: string }> };
    }>;
  }>(`/v2/checkout/orders/${orderId}`);
  const pu = order.purchase_units?.[0];
  const cap = pu?.payments?.captures?.[0];
  const { buchungId, paymentType } = parseCustomId(pu?.custom_id);
  return {
    orderId: order.id,
    status: order.status,
    captureId: cap?.id || null,
    amountEur: Number(cap?.amount?.value || pu?.amount?.value || 0),
    buchungId,
    paymentType,
    alreadyCaptured: order.status === "COMPLETED" || cap?.status === "COMPLETED",
  };
}

/**
 * Zieht eine genehmigte (APPROVED) Order ein. Idempotent: eine bereits eingezogene Order
 * (status COMPLETED bzw. ORDER_ALREADY_CAPTURED) wird NICHT als Fehler behandelt —
 * wir laden dann den bestehenden Capture aus der Order.
 */
export async function captureOrder(orderId: string): Promise<PayPalCaptureResult> {
  try {
    const res = await paypalFetch<{
      id: string;
      status: string;
      purchase_units?: Array<{
        custom_id?: string;
        payments?: { captures?: Array<{ id: string; amount?: { value?: string }; status: string }> };
      }>;
    }>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", body: {} });
    const pu = res.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    const { buchungId, paymentType } = parseCustomId(pu?.custom_id);
    return {
      orderId: res.id,
      status: res.status,
      captureId: cap?.id || null,
      amountEur: Number(cap?.amount?.value || 0),
      buchungId,
      paymentType,
      alreadyCaptured: cap?.status === "COMPLETED",
    };
  } catch (e) {
    // Bereits eingezogen (z. B. Webhook CHECKOUT.ORDER.APPROVED war schneller) → Order laden.
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("ORDER_ALREADY_CAPTURED") || msg.includes("ORDER_NOT_APPROVED")) {
      const existing = await getOrder(orderId);
      if (existing.alreadyCaptured) return existing;
    }
    throw e;
  }
}

/**
 * Verifiziert die Echtheit eines PayPal-Webhook-Events ueber die
 * verify-webhook-signature-API. `headers` = die eingehenden PayPal-Header,
 * `rawEvent` = das GEPARSTE JSON des Request-Bodys.
 */
export async function verifyWebhookSignature(
  headers: {
    authAlgo: string | null;
    certUrl: string | null;
    transmissionId: string | null;
    transmissionSig: string | null;
    transmissionTime: string | null;
  },
  rawEvent: unknown,
): Promise<boolean> {
  if (
    !headers.authAlgo ||
    !headers.certUrl ||
    !headers.transmissionId ||
    !headers.transmissionSig ||
    !headers.transmissionTime
  ) {
    return false;
  }
  const res = await paypalFetch<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: getPayPalWebhookId(),
        webhook_event: rawEvent,
      },
    },
  );
  return res.verification_status === "SUCCESS";
}
