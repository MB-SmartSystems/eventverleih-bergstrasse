/**
 * POST /api/paypal/webhook — PayPal-Webhook-Handler.
 *
 * Verarbeitet:
 *   - CHECKOUT.ORDER.APPROVED   → Order einziehen (falls return-Handler es nicht schon tat,
 *                                 z. B. Kunde hat Browser vor dem Redirect geschlossen) + verbuchen
 *   - PAYMENT.CAPTURE.COMPLETED → Zahlung verbuchen (autoritativ, idempotent)
 *
 * Signatur-Verifikation via PayPal verify-webhook-signature (zwingend, braucht PAYPAL_WEBHOOK_ID).
 * Idempotenz auf PayPal-event.id-Ebene ueber eine Audit-Marker-Row (analog Stripe-Webhook).
 *
 * runtime nodejs + force-dynamic wegen Raw-Body-Reading (req.text()).
 */
import { NextRequest, NextResponse } from "next/server";
import { createRow, listRows, TABLES } from "@/lib/baserow/client";
import { verifyWebhookSignature, captureOrder, getOrder } from "@/lib/paypal/orders";
import { verbuchePayPalZahlung, type PayPalPaymentType } from "@/lib/eventverleih/paypal-verbuchen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normType(t: string | undefined | null): PayPalPaymentType | null {
  return t === "anzahlung" || t === "restzahlung" || t === "komplettzahlung" ? t : null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let event: {
    id?: string;
    event_type?: string;
    resource?: {
      id?: string;
      custom_id?: string;
      amount?: { value?: string };
      purchase_units?: Array<{ custom_id?: string }>;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Signatur pruefen (Echtheit) — ohne gueltige Signatur NICHT verarbeiten.
  const ok = await verifyWebhookSignature(
    {
      authAlgo: req.headers.get("paypal-auth-algo"),
      certUrl: req.headers.get("paypal-cert-url"),
      transmissionId: req.headers.get("paypal-transmission-id"),
      transmissionSig: req.headers.get("paypal-transmission-sig"),
      transmissionTime: req.headers.get("paypal-transmission-time"),
    },
    event,
  ).catch((e) => {
    console.error("[paypal-webhook] Signatur-Check-Fehler:", e instanceof Error ? e.message : e);
    return false;
  });
  if (!ok) {
    return NextResponse.json({ error: "signature_failed" }, { status: 400 });
  }

  // Event-Dedup (PayPal liefert at-least-once).
  const dedupKey = `paypal_evt:${event.id || ""}`;
  if (event.id) {
    try {
      const seen = await listRows<{ Name: string }>(TABLES.Audit_Log, { search: dedupKey, size: 20 });
      if (seen.results.some((r) => (r.Name || "") === dedupKey)) {
        return NextResponse.json({ ok: true, note: "event_bereits_verarbeitet", event_id: event.id });
      }
    } catch (e) {
      console.error("[paypal-webhook] event-dedup-check fehlgeschlagen:", e);
    }
  }

  let response: NextResponse;
  try {
    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED": {
        const orderId = event.resource?.id;
        if (!orderId) {
          response = NextResponse.json({ ok: true, note: "no_order_id" });
          break;
        }
        // Falls der return-Handler die Order noch nicht eingezogen hat: hier einziehen.
        const cap = await captureOrder(orderId).catch(async (e) => {
          console.warn("[paypal-webhook] capture in APPROVED fehlgeschlagen, lade Order:", e instanceof Error ? e.message : e);
          return getOrder(orderId);
        });
        if (cap.alreadyCaptured && cap.captureId && cap.buchungId && cap.paymentType) {
          await verbuchePayPalZahlung({
            buchungId: cap.buchungId,
            paymentType: cap.paymentType,
            captureId: cap.captureId,
            amountEur: cap.amountEur,
          });
          response = NextResponse.json({ ok: true, processed: "approved_captured" });
        } else {
          response = NextResponse.json({ ok: true, note: "not_captured_yet", status: cap.status });
        }
        break;
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        const r = event.resource;
        const captureId = r?.id;
        const custom = r?.custom_id || r?.purchase_units?.[0]?.custom_id || "";
        const [idRaw, typeRaw] = custom.split(":");
        const buchungId = parseInt(idRaw || "", 10) || null;
        const paymentType = normType(typeRaw);
        const amountEur = Number(r?.amount?.value || 0);
        if (!captureId || !buchungId || !paymentType) {
          response = NextResponse.json({ ok: true, note: "unvollstaendige_capture_daten" });
          break;
        }
        const res = await verbuchePayPalZahlung({ buchungId, paymentType, captureId, amountEur });
        response = NextResponse.json(res);
        break;
      }

      default:
        response = NextResponse.json({ ok: true, ignored: event.event_type });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal";
    console.error("[paypal-webhook]", event.event_type, msg);
    // Fehler → NICHT als verarbeitet markieren, damit PayPal erneut zustellt.
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }

  // Erfolg → event.id als verarbeitet markieren.
  if (event.id) {
    try {
      await createRow(TABLES.Audit_Log, {
        Name: dedupKey,
        Aktion: "PayPal_Event",
        Zeitpunkt: new Date().toISOString(),
        Akteur: "PayPal-Webhook",
        Details: JSON.stringify({ event_id: event.id, type: event.event_type }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[paypal-webhook] event-dedup-marker schreiben fehlgeschlagen:", e);
    }
  }
  return response;
}
