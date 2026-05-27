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
import { refundPayment, deactivatePaymentLinksFor } from "@/lib/stripe/payment-links";
import { checkConflicts } from "@/lib/eventverleih/conflicts";
import { invalidateAvailabilityCache } from "@/lib/eventverleih/availability";
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

// Stati, die bedeuten "Reservierungs-Zahlung schon verarbeitet" (Idempotenz-Guard).
const SCHON_VERARBEITET = new Set([
  "Reserviert",
  "Uebergeben",
  "In_Miete",
  "Zurueckgegeben",
  "Abgerechnet",
  "Storniert",
]);

type ReservierungBuchung = {
  Status_Erweitert: { value: string } | null;
  Event_datum_bis: string | null;
  Storno_Betrag_Eur: string | number | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
};

/**
 * Verarbeitet eine Reservierungs-Zahlung (Anzahlung ODER Komplettzahlung).
 *
 * Konflikt-/Doppelbuchungs-Schutz (first-to-pay-wins):
 *  - Ist der Termin bereits HART vergeben (anderer Kunde hat zuerst gezahlt → Reserviert/
 *    Uebergeben/In_Miete), kam DIESE Zahlung zu spaet → Auto-Refund + Storno, KEIN Reserviert,
 *    eigene Stripe-Links deaktivieren, Kunde per Mail informieren.
 *  - Sonst: wie gehabt Reserviert + resolveKonfliktAfterAnzahlung (storniert weiche Verlierer).
 * Idempotent: bereits verarbeitete Buchungen (Status in SCHON_VERARBEITET) werden uebersprungen;
 * Refund nur wenn noch kein Storno_Betrag gesetzt.
 */
async function processReservierungsZahlung(
  pi: Stripe.PaymentIntent,
  buchungId: number,
  paymentType: "anzahlung" | "komplettzahlung",
): Promise<NextResponse> {
  const buchung = await getRow<ReservierungBuchung>(TABLES.Buchungen, buchungId);
  const curStatus = buchung.Status_Erweitert?.value || "";
  if (SCHON_VERARBEITET.has(curStatus)) {
    return NextResponse.json({ ok: true, note: `bereits_verarbeitet:${curStatus}` });
  }

  // Konflikt-Guard: ist der Termin bereits hart vergeben?
  let hartConflict: { buchung_id: number } | undefined;
  try {
    const conflicts = await checkConflicts(buchungId);
    hartConflict = conflicts.find((c) => c.is_hard);
  } catch (e) {
    console.error("[stripe-webhook] checkConflicts fehlgeschlagen:", e);
  }

  if (hartConflict) {
    // Zu spaet — Termin schon vergeben. Auto-Refund + Storno.
    let refunded = false;
    const alreadyRefunded = !!buchung.Storno_Betrag_Eur && Number(buchung.Storno_Betrag_Eur) > 0;
    if (!alreadyRefunded) {
      try {
        await refundPayment(pi.id);
        refunded = true;
      } catch (e) {
        console.error("[stripe-webhook] Auto-Refund fehlgeschlagen:", e);
      }
    }
    await updateRow(TABLES.Buchungen, buchungId, {
      Status_Erweitert: "Storniert",
      Storno_Grund: "Konflikt_verloren_nach_Zahlung",
      Storno_am: new Date().toISOString().slice(0, 10),
      Storno_Betrag_Eur: (pi.amount || 0) / 100,
    });
    try {
      await deactivatePaymentLinksFor(buchungId, "anzahlung");
      await deactivatePaymentLinksFor(buchungId, "komplettzahlung");
      await deactivatePaymentLinksFor(buchungId, "restzahlung");
    } catch (e) {
      console.error("[stripe-webhook] Link-Deaktivierung fehlgeschlagen:", e);
    }
    const kundeId = buchung.Kunde_Link?.[0]?.id;
    const kundeName = buchung.Kunde_Link?.[0]?.value || "Kunde";
    if (kundeId) {
      try {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Buchung_Link: [buchungId],
          Kunde_Link: [kundeId],
          Template_Key: "konflikt_refund",
          Subject: "Ihre Zahlung wurde erstattet | Eventverleih Bergstraße",
          Body: `Hallo ${kundeName},\n\nleider war jemand anderes wenige Augenblicke schneller — der von Ihnen gewünschte Termin ist inzwischen vergeben. Ihre soeben geleistete Zahlung haben wir Ihnen daher vollständig erstattet (sie erscheint je nach Bank in 1-5 Werktagen wieder auf Ihrem Konto).\n\nGerne finden wir einen anderen Termin für Sie — melden Sie sich einfach per WhatsApp oder Anruf: +49 156 79521124.\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de`,
          Approval_Status: "Auto_Reply",
          Idempotency_Key: `B${buchungId}-konflikt_refund`,
        });
      } catch (e) {
        console.error("[stripe-webhook] Refund-Mail fehlgeschlagen:", e);
      }
    }
    await logAudit(buchungId, "Konflikt_verloren_nach_Zahlung", {
      stripe_payment_intent: pi.id,
      refunded,
      gegen_buchung_id: hartConflict.buchung_id,
      amount_eur: (pi.amount || 0) / 100,
    });
    invalidateAvailabilityCache();
    return NextResponse.json({ ok: true, processed: paymentType, refunded, note: "termin_bereits_vergeben" });
  }

  // Normalfall: Reservierung setzen
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = {
    Status_Erweitert: "Reserviert",
    Anzahlung_Bezahlt_am: today,
  };
  if (paymentType === "komplettzahlung") patch.Restzahlung_Bezahlt_am = today;
  if (buchung.Event_datum_bis) patch.Lock_Until = `${buchung.Event_datum_bis}T23:59:59Z`;
  await updateRow(TABLES.Buchungen, buchungId, patch);
  await logAudit(
    buchungId,
    paymentType === "komplettzahlung" ? "Komplettzahlung_eingegangen" : "Anzahlung_eingegangen",
    {
      stripe_payment_intent: pi.id,
      amount_eur: (pi.amount || 0) / 100,
      new_status: "Reserviert",
      lock_until: buchung.Event_datum_bis,
    },
  );
  await resolveKonfliktAfterAnzahlung(buchungId);
  invalidateAvailabilityCache();
  return NextResponse.json({ ok: true, processed: paymentType });
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
          return await processReservierungsZahlung(pi, buchungId, "anzahlung");
        } else if (paymentType === "restzahlung") {
          await updateRow(TABLES.Buchungen, buchungId, {
            Restzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
          });
          await logAudit(buchungId, "Restzahlung_eingegangen", {
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
          });
        } else if (paymentType === "komplettzahlung") {
          return await processReservierungsZahlung(pi, buchungId, "komplettzahlung");
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
