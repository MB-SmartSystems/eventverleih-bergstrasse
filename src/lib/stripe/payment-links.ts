/**
 * Payment-Link-Generator fuer Eventverleih-Buchungen.
 *
 * Pro Buchung werden Stripe-Payment-Links erzeugt:
 *   - Anzahlung (typ. 30%)
 *   - Restzahlung (verbleibender Betrag)
 *
 * Metadata: buchung_id + payment_type — Webhook-Handler routet via Metadata.
 *
 * Kaution wird separat als PaymentIntent mit `capture_method: "manual"` gehandled
 * (siehe lib/stripe/kaution.ts).
 */
import { getStripe } from "./client";

export type PaymentType = "anzahlung" | "restzahlung";

interface CreatePaymentLinkParams {
  buchungId: number;
  paymentType: PaymentType;
  amountEur: number;
  kundeName: string;
  kundeEmail?: string;
  description?: string;
}

interface PaymentLinkResult {
  link_url: string;
  link_id: string;
}

export async function createPaymentLink(
  params: CreatePaymentLinkParams,
): Promise<PaymentLinkResult> {
  const stripe = getStripe();
  const amountCents = Math.round(params.amountEur * 100);
  if (amountCents <= 0) {
    throw new Error(`Invalid amount: ${params.amountEur}`);
  }

  // Stripe Payment Link mit Inline Price (kein vorab-Produkt noetig)
  const product = await stripe.products.create({
    name:
      params.description ||
      `Eventverleih-${params.paymentType} Buchung #${params.buchungId}`,
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: params.paymentType,
    },
  });

  const price = await stripe.prices.create({
    currency: "eur",
    unit_amount: amountCents,
    product: product.id,
  });

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: params.paymentType,
      kunde_name: params.kundeName.slice(0, 250),
    },
    payment_intent_data: {
      metadata: {
        buchung_id: String(params.buchungId),
        payment_type: params.paymentType,
      },
    },
    after_completion: {
      type: "hosted_confirmation",
      hosted_confirmation: {
        custom_message:
          params.paymentType === "anzahlung"
            ? "Vielen Dank! Ihre Anzahlung ist eingegangen — die Reservierung ist jetzt verbindlich. Sie erhalten in Kuerze eine Bestaetigung per Mail."
            : "Vielen Dank! Restzahlung eingegangen — wir freuen uns auf Ihr Event.",
      },
    },
  });

  return { link_url: link.url, link_id: link.id };
}

/**
 * Kaution als Pre-Auth-Hold (capture_method: manual).
 * Wird im Uebergabe-Dialog erzeugt, im Rueckgabe-Dialog gecaptured (Schaden) oder gecancelled (kein Schaden).
 *
 * NOTE: Pre-Auth haelt max 7 Tage. Bei laengeren Mietzeitraeumen muss alternativ
 * ein echter Charge + Refund-Flow verwendet werden (s. lib/stripe/kaution.ts).
 */
export async function createKautionPreAuth(params: {
  buchungId: number;
  amountEur: number;
  kundeName: string;
  kundeEmail?: string;
}): Promise<{ payment_intent_id: string; client_secret: string }> {
  const stripe = getStripe();
  const amountCents = Math.round(params.amountEur * 100);
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    capture_method: "manual",
    description: `Kaution Buchung #${params.buchungId} — ${params.kundeName}`,
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: "kaution",
    },
    automatic_payment_methods: { enabled: true },
  });
  return {
    payment_intent_id: intent.id,
    client_secret: intent.client_secret || "",
  };
}

/**
 * Captures (= bucht ab) einen Teil oder den vollen Pre-Auth-Hold.
 * Bei Schaden: amount_to_capture = schaden_eur.
 */
export async function captureKaution(paymentIntentId: string, amountEur?: number) {
  const stripe = getStripe();
  const opts: { amount_to_capture?: number } = {};
  if (amountEur !== undefined) {
    opts.amount_to_capture = Math.round(amountEur * 100);
  }
  return stripe.paymentIntents.capture(paymentIntentId, opts);
}

/**
 * Cancelt den Pre-Auth-Hold komplett — Geld verfaellt vom Kunden-Konto.
 * Aufruf wenn keine Schaeden festgestellt wurden.
 */
export async function cancelKaution(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Refund auf eine bereits abgebuchte Anzahlung/Restzahlung — fuer Storno-Workflow.
 */
export async function refundPayment(paymentIntentId: string, amountEur?: number) {
  const stripe = getStripe();
  const opts: { payment_intent: string; amount?: number } = { payment_intent: paymentIntentId };
  if (amountEur !== undefined) {
    opts.amount = Math.round(amountEur * 100);
  }
  return stripe.refunds.create(opts);
}
