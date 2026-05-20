/**
 * POST /api/stripe/webhook — Stripe-Webhook-Handler.
 *
 * Verarbeitet:
 *   - payment_intent.succeeded fuer Anzahlung/Restzahlung -> Status-Update + Konflikt-Aufloesung
 *   - payment_intent.amount_capturable_updated fuer Kaution-Hold platziert -> PaymentIntent-ID speichern
 *   - payment_intent.canceled fuer Kaution-Hold-Abbruch
 *   - charge.refunded fuer Storno-Refunds -> Marker setzen
 *
 * Signature-Verify zwingend (Stripe-Best-Practice).
 *
 * Wichtig: Next.js Route-Handler braucht `runtime: "nodejs"` + `dynamic: "force-dynamic"`
 * fuer Raw-Body-Reading via req.text(). Stripe-SDK braucht NodeJS Crypto.
 */
import { NextRequest, NextResponse } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe/client";
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { resolveKonfliktAfterAnzahlung } from "@/lib/eventverleih/konflikt-aufloesung";
import Stripe from "stripe";

async function logAudit(buchungId: number, aktion: string, details: Record<string, unknown>) {
  try {
    await createRow(TABLES.Audit_Log, {
      Name: `${aktion} Buchung #${buchungId}`,
      Aktion: aktion,
      Zeitpunkt: new Date().toISOString(),
      Buchung_ID_Ref: String(buchungId),
      Akteur: "Stripe-Webhook",
      Details: JSON.stringify(details),
      Aktiv: true,
    });
  } catch (e) {
    console.error("[audit-log]", aktion, e);
  }
}

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
          // Buchung auf "Reserviert" hochsetzen, Anzahlung_Bezahlt_am setzen
          // + Lock_Until auf Event_datum_bis fuer Hart-Block-Sichtbarkeit
          const buchung = await getRow<{ Event_datum_bis: string | null }>(
            TABLES.Buchungen,
            buchungId,
          );
          const patch: Record<string, unknown> = {
            Status_Erweitert: "Reserviert",
            Anzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
          };
          if (buchung.Event_datum_bis) {
            patch.Lock_Until = `${buchung.Event_datum_bis}T23:59:59Z`;
          }
          await updateRow(TABLES.Buchungen, buchungId, patch);
          await logAudit(buchungId, "Anzahlung_eingegangen", {
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
            new_status: "Reserviert",
            lock_until: buchung.Event_datum_bis,
          });
          // Konflikt-Aufloesung: konkurrierende Buchungen auto-stornieren
          await resolveKonfliktAfterAnzahlung(buchungId);
        } else if (paymentType === "restzahlung") {
          await updateRow(TABLES.Buchungen, buchungId, {
            Restzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
          });
          await logAudit(buchungId, "Restzahlung_eingegangen", {
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
          });
        } else if (paymentType === "komplettzahlung") {
          // Kunde hat alles auf einmal bezahlt → Anzahlung + Restzahlung beide markiert,
          // Status=Reserviert, Lock_Until setzen (gleicher Effekt wie Anzahlung allein)
          const buchung = await getRow<{ Event_datum_bis: string | null }>(
            TABLES.Buchungen,
            buchungId,
          );
          const today = new Date().toISOString().slice(0, 10);
          const patch: Record<string, unknown> = {
            Status_Erweitert: "Reserviert",
            Anzahlung_Bezahlt_am: today,
            Restzahlung_Bezahlt_am: today,
          };
          if (buchung.Event_datum_bis) {
            patch.Lock_Until = `${buchung.Event_datum_bis}T23:59:59Z`;
          }
          await updateRow(TABLES.Buchungen, buchungId, patch);
          await logAudit(buchungId, "Komplettzahlung_eingegangen", {
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
            new_status: "Reserviert",
            lock_until: buchung.Event_datum_bis,
          });
          await resolveKonfliktAfterAnzahlung(buchungId);
        } else if (paymentType === "kaution") {
          // Pre-Auth-Hold ist jetzt confirmed (Geld reserviert beim Kunden)
          await updateRow(TABLES.Buchungen, buchungId, {
            Kaution_Hinterlegt_am: new Date().toISOString().slice(0, 10),
          });
          await logAudit(buchungId, "Sonstiges", {
            event: "kaution_hinterlegt_via_stripe",
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
          });
        }
        return NextResponse.json({ ok: true, processed: paymentType });
      }

      case "payment_intent.amount_capturable_updated": {
        // Kaution-Pre-Auth-Hold wurde platziert (Kunde hat im Checkout bezahlt, Stripe blockt
        // den Betrag, aber kein Charge). Wir speichern die PaymentIntent-ID damit Manuel sie
        // bei der Rueckgabe via cancelKaution/captureKaution aufloesen kann.
        const pi = event.data.object as Stripe.PaymentIntent;
        const buchungId = parseInt(pi.metadata?.buchung_id || "", 10);
        const paymentType = pi.metadata?.payment_type;
        if (!buchungId || paymentType !== "kaution") {
          return NextResponse.json({ ok: true, note: "no buchung_id or not kaution" });
        }
        await updateRow(TABLES.Buchungen, buchungId, {
          Stripe_Kaution_PaymentIntent: pi.id,
          Kaution_Hinterlegt_am: new Date().toISOString().slice(0, 10),
        });
        await logAudit(buchungId, "Sonstiges", {
          event: "kaution_hold_platziert",
          stripe_payment_intent: pi.id,
          amount_capturable_eur: (pi.amount_capturable || 0) / 100,
        });
        return NextResponse.json({ ok: true, processed: "kaution_hold" });
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
