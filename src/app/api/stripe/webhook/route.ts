/**
 * POST /api/stripe/webhook — Stripe-Webhook-Handler.
 *
 * Verarbeitet:
 *   - payment_intent.succeeded fuer Anzahlung/Restzahlung -> Status-Update + Konflikt-Aufloesung
 *   - charge.refunded fuer Storno-Refunds -> Marker setzen
 *   - payment_intent.canceled fuer Kaution-Hold-Abbruch
 *
 * Signature-Verify zwingend (Stripe-Best-Practice).
 *
 * Wichtig: Next.js Route-Handler braucht `runtime: "nodejs"` + `dynamic: "force-dynamic"`
 * fuer Raw-Body-Reading via req.text(). Stripe-SDK braucht NodeJS Crypto.
 */
import { NextRequest, NextResponse } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe/client";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { resolveKonfliktAfterAnzahlung } from "@/lib/eventverleih/konflikt-aufloesung";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, getWebhookSecret());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "signature verify failed";
    return NextResponse.json({ error: "signature_failed", detail: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const buchungId = parseInt(pi.metadata?.buchung_id || "", 10);
        const paymentType = pi.metadata?.payment_type;
        if (!buchungId || !paymentType) {
          return NextResponse.json({ ok: true, note: "no metadata" });
        }

        if (paymentType === "anzahlung") {
          // Buchung auf "Reserviert" hochsetzen + Anzahlung_Bezahlt_am setzen
          await updateRow(TABLES.Buchungen, buchungId, {
            Status_Erweitert: "Reserviert",
            Anzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
          });
          // Konflikt-Aufloesung: konkurrierende Buchungen auto-stornieren
          await resolveKonfliktAfterAnzahlung(buchungId);
        } else if (paymentType === "restzahlung") {
          await updateRow(TABLES.Buchungen, buchungId, {
            Restzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
          });
        } else if (paymentType === "kaution") {
          // Pre-Auth-Hold ist jetzt confirmed (Geld reserviert beim Kunden)
          await updateRow(TABLES.Buchungen, buchungId, {
            Kaution_Hinterlegt_am: new Date().toISOString().slice(0, 10),
          });
        }
        return NextResponse.json({ ok: true, processed: paymentType });
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const buchungId = parseInt(pi.metadata?.buchung_id || "", 10);
        if (!buchungId) return NextResponse.json({ ok: true });
        // Kaution-Hold gecancelled (keine Schaden-Capture) — kein Buchungs-Update noetig
        return NextResponse.json({ ok: true, note: "kaution_canceled" });
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const buchungId = parseInt(charge.metadata?.buchung_id || "", 10);
        if (!buchungId) return NextResponse.json({ ok: true });
        // Storno-Refund — Marker setzen
        const refundEur = (charge.amount_refunded || 0) / 100;
        await updateRow(TABLES.Buchungen, buchungId, {
          Storno_Betrag_Eur: refundEur,
        });
        return NextResponse.json({ ok: true, refunded_eur: refundEur });
      }

      default:
        return NextResponse.json({ ok: true, ignored: event.type });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[stripe-webhook]", event.type, msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
