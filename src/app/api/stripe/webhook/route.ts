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
import { listOpenStockConflicts } from "@/lib/eventverleih/conflicts";
import { invalidateAvailabilityCache } from "@/lib/eventverleih/availability";
import { kundeNameAusLink, anredeZeile } from "@/lib/eventverleih/kunde-name";
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
  Anzahlung_Soll_Eur: string | number | null;
  Restzahlung_Soll_Eur: string | number | null;
};

function eurNum(v: string | number | null): number {
  return typeof v === "number" ? v : parseFloat(v ?? "0") || 0;
}

/**
 * Verarbeitet eine Reservierungs-Zahlung (Anzahlung ODER Komplettzahlung).
 *
 * first-to-pay-wins, aber WEICH: Eine Zahlung fuehrt IMMER zu "Reserviert". Geld wird NIE
 * automatisch zurueckgebucht, keine Buchung automatisch storniert. Entsteht durch die Zahlung
 * ein ECHTER Mengen-Engpass (geteilter, nicht bestellbarer Artikel ueberbucht), wird die
 * Buchung nur geflaggt (Konflikt_Mit_Buchung_ID + Audit) und erscheint im Dashboard -- Manuel
 * entscheidet (nachkaufen / passt / manuell stornieren mit Refund).
 * Idempotent: bereits verarbeitete Buchungen (Status in SCHON_VERARBEITET) werden uebersprungen.
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

  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = {
    Status_Erweitert: "Reserviert",
    Anzahlung_Bezahlt_am: today,
    Anzahlung_Bezahlt_Eur: eurNum(buchung.Anzahlung_Soll_Eur),
  };
  if (paymentType === "komplettzahlung") {
    patch.Restzahlung_Bezahlt_am = today;
    patch.Restzahlung_Bezahlt_Eur = eurNum(buchung.Restzahlung_Soll_Eur);
  }
  if (buchung.Event_datum_bis) patch.Lock_Until = `${buchung.Event_datum_bis}T23:59:59Z`;
  await updateRow(TABLES.Buchungen, buchungId, patch);
  await logAudit(buchungId, "Anzahlung_eingegangen", {
    payment_type: paymentType,
    stripe_payment_intent: pi.id,
    amount_eur: (pi.amount || 0) / 100,
    new_status: "Reserviert",
    lock_until: buchung.Event_datum_bis,
  });

  // Bestaetigungs-Mail je nach Zahlungsart (fail-soft, idempotent):
  //  - komplettzahlung: "vollstaendig bezahlt"
  //  - anzahlung: "Termin verbindlich reserviert, Restzahlung folgt zur Uebergabe"
  // (Frueher bekam der Anzahlung-only-Kunde GAR keine Bestaetigung -> Vertrauensluecke.)
  try {
    const b = await getRow<{ Kunde_Link: Array<{ id: number; value: string }> | null }>(TABLES.Buchungen, buchungId);
    const kid = b.Kunde_Link?.[0]?.id;
    // NICHT .value — das ist die Kunde_ID-Zahl ("Hallo 12"-Bug). Echten Namen laden.
    const kname = await kundeNameAusLink(b.Kunde_Link);
    if (kid && paymentType === "komplettzahlung") {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [buchungId],
        Kunde_Link: [kid],
        Template_Key: "komplettzahlung_erhalten",
        Subject: "Zahlung erhalten — Ihre Buchung ist vollständig bezahlt",
        Body: `${anredeZeile(kname)}\n\nvielen Dank — Ihre Zahlung ist bei uns eingegangen. Ihre Buchung ist damit vollständig bezahlt. Wir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-komplettzahlung_erhalten`,
      });
    } else if (kid && paymentType === "anzahlung") {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [buchungId],
        Kunde_Link: [kid],
        Template_Key: "anzahlung_erhalten",
        Subject: "Anzahlung erhalten — Ihr Termin ist reserviert",
        Body: `${anredeZeile(kname)}\n\nvielen Dank — Ihre Anzahlung ist bei uns eingegangen. Ihr Termin ist damit verbindlich für Sie reserviert. Die Restzahlung wird zur Übergabe fällig; wir erinnern Sie rechtzeitig.\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-anzahlung_erhalten`,
      });
    }
  } catch (e) {
    console.error("[stripe-webhook] Zahlungs-Bestaetigung fehlgeschlagen:", e);
  }

  // Mengen-genauer Engpass-Check -> nur flaggen, nichts Destruktives.
  try {
    const conflicts = await listOpenStockConflicts();
    const mine = conflicts.filter((g) => g.buchungen.some((b) => b.id === buchungId));
    if (mine.length > 0) {
      const beteiligte = Array.from(
        new Set(mine.flatMap((g) => g.buchungen.map((b) => b.id)).filter((id) => id !== buchungId)),
      );
      if (beteiligte.length > 0) {
        await updateRow(TABLES.Buchungen, buchungId, { Konflikt_Mit_Buchung_ID: beteiligte });
      }
      await logAudit(buchungId, "Konflikt_erkannt", {
        artikel: mine.map((g) => `${g.artikel_name} (${g.nachgefragt}/${g.bestand})`),
        beteiligte_buchungen: beteiligte,
        hinweis: "Manuel-Entscheidung noetig - kein Auto-Storno/Refund",
      });
    }
  } catch (e) {
    console.error("[stripe-webhook] Engpass-Check fehlgeschlagen:", e);
  }

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
            Restzahlung_Bezahlt_Eur: (pi.amount || 0) / 100,
          });
          await logAudit(buchungId, "Restzahlung_eingegangen", {
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
          });
          // Bestaetigungs-Mail an Kunden (fail-soft, idempotent)
          try {
            const b = await getRow<{ Kunde_Link: Array<{ id: number; value: string }> | null }>(TABLES.Buchungen, buchungId);
            const kid = b.Kunde_Link?.[0]?.id;
            // NICHT .value — das ist die Kunde_ID-Zahl ("Hallo 12"-Bug). Echten Namen laden.
            const kname = await kundeNameAusLink(b.Kunde_Link);
            if (kid) {
              await createRow(TABLES.MailQueue, {
                Erstellt_am: new Date().toISOString(),
                Buchung_Link: [buchungId],
                Kunde_Link: [kid],
                Template_Key: "restzahlung_erhalten",
                Subject: "Zahlung erhalten — Ihre Buchung ist vollständig bezahlt",
                Body: `${anredeZeile(kname)}\n\nvielen Dank — Ihre Restzahlung ist bei uns eingegangen. Ihre Buchung ist damit vollständig bezahlt. Wir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
                Approval_Status: "Auto_Reply",
                Idempotency_Key: `B${buchungId}-restzahlung_erhalten`,
              });
            }
          } catch (e) {
            console.error("[stripe-webhook] Restzahlung-Bestaetigung fehlgeschlagen:", e);
          }
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
