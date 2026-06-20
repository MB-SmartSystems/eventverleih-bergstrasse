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
import { queueAnzahlungErhaltenMail } from "@/lib/eventverleih/zahlungsbestaetigung";
import { bucheEinnahme, gebuchteSummeMitQuelle } from "@/lib/eventverleih/einnahme";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";
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
  const ist = (pi.amount || 0) / 100;
  const sollAnz = eurNum(buchung.Anzahlung_Soll_Eur);
  const sollRest = eurNum(buchung.Restzahlung_Soll_Eur);
  const patch: Record<string, unknown> = {
    Status_Erweitert: "Reserviert",
    Anzahlung_Bezahlt_am: today,
    // Ist-Betrag (tatsächlich gezahlt) statt Soll — konsistent zu Restzahlung + Einnahme.
    Anzahlung_Bezahlt_Eur: paymentType === "komplettzahlung" ? sollAnz : ist,
    // Miet-Zahlungs-PaymentIntent persistieren, damit ein späterer Storno-Refund die
    // richtige PI hat (NICHT die Kaution-Hold-PI). Letzte Zahlung gewinnt.
    Stripe_Zahlung_PaymentIntent: pi.id,
  };
  if (paymentType === "komplettzahlung") {
    patch.Restzahlung_Bezahlt_am = today;
    // Komplett = eine Zahlung über die Gesamtsumme: Anzahlung bleibt Soll, der Rest
    // absorbiert die Differenz, sodass Anzahlung + Rest == tatsächlich gezahltem Ist.
    patch.Restzahlung_Bezahlt_Eur = Math.round((ist - sollAnz) * 100) / 100;
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

  // Ist ≠ Soll (z. B. veralteter Zahlungslink): sichtbar machen statt still normalisieren.
  const sollTotal = paymentType === "komplettzahlung" ? sollAnz + sollRest : sollAnz;
  if (Math.abs(ist - sollTotal) > 0.01) {
    await logAudit(buchungId, "Sonstiges", {
      event: "betrag_divergenz",
      payment_type: paymentType,
      ist_eur: ist,
      soll_eur: sollTotal,
      stripe_payment_intent: pi.id,
    });
  }

  // Einnahme nach Zuflussprinzip (Modell A) — idempotent über die PI-ID.
  await bucheEinnahme({
    buchungId,
    quelle: pi.id,
    betragEur: ist,
    datum: today,
    beschreibung:
      paymentType === "komplettzahlung"
        ? `Komplettzahlung (Miete) Buchung #${buchungId}`
        : `Anzahlung Buchung #${buchungId}`,
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
        Body: `${anredeZeile(kname)}\n\nvielen Dank — Ihre Zahlung ist bei uns eingegangen. Ihre Buchung ist damit vollständig bezahlt.\n\n${UEBERGABE_HINWEIS}\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-komplettzahlung_erhalten`,
      });
    } else if (kid && paymentType === "anzahlung") {
      // Gemeinsamer Pfad mit dem manuellen Zahlung-Erfassen (Bar/Überweisung) —
      // gleicher Text, gleicher Idempotency_Key, nie doppelt.
      await queueAnzahlungErhaltenMail(buchungId);
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
          // Idempotenz: Stripe liefert Events at-least-once. Ohne Guard wuerde ein
          // Re-Delivery die Restzahlung erneut verbuchen + den Audit-Log duplizieren.
          const rb = await getRow<{ Restzahlung_Bezahlt_am: string | null }>(TABLES.Buchungen, buchungId);
          if (rb.Restzahlung_Bezahlt_am) {
            return NextResponse.json({ ok: true, note: "restzahlung_bereits_verbucht" });
          }
          await updateRow(TABLES.Buchungen, buchungId, {
            Restzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
            Restzahlung_Bezahlt_Eur: (pi.amount || 0) / 100,
            Stripe_Zahlung_PaymentIntent: pi.id,
          });
          await logAudit(buchungId, "Restzahlung_eingegangen", {
            stripe_payment_intent: pi.id,
            amount_eur: (pi.amount || 0) / 100,
          });
          // Einnahme nach Zuflussprinzip (Modell A) — idempotent über die PI-ID.
          await bucheEinnahme({
            buchungId,
            quelle: pi.id,
            betragEur: (pi.amount || 0) / 100,
            datum: new Date().toISOString().slice(0, 10),
            beschreibung: `Restzahlung Buchung #${buchungId}`,
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
                Body: `${anredeZeile(kname)}\n\nvielen Dank — Ihre Restzahlung ist bei uns eingegangen. Ihre Buchung ist damit vollständig bezahlt.\n\n${UEBERGABE_HINWEIS}\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
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
          // Pre-Auth-Hold ist jetzt confirmed (Geld reserviert beim Kunden).
          // Hinterlegt_am nur setzen wenn noch leer — sonst ueberschreibt ein spaeteres
          // succeeded (nach Capture) das urspruengliche Hold-Datum aus amount_capturable_updated.
          const kb = await getRow<{ Kaution_Hinterlegt_am: string | null }>(TABLES.Buchungen, buchungId);
          if (!kb.Kaution_Hinterlegt_am) {
            await updateRow(TABLES.Buchungen, buchungId, {
              Kaution_Hinterlegt_am: new Date().toISOString().slice(0, 10),
            });
          }
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
        // buchung_id steht auf der PaymentIntent-Metadata, nicht zwingend auf der Charge —
        // bei Bedarf die PI nachladen.
        let buchungId = parseInt(charge.metadata?.buchung_id || "", 10);
        if (!buchungId && typeof charge.payment_intent === "string") {
          try {
            const pi = await getStripe().paymentIntents.retrieve(charge.payment_intent);
            buchungId = parseInt(pi.metadata?.buchung_id || "", 10);
          } catch (e) {
            console.error("[stripe-webhook] PI-Lookup für Refund fehlgeschlagen:", e);
          }
        }
        // amount_refunded ist KUMULATIV über alle Teil-Refunds der Charge. Wir buchen das
        // Delta zum bereits gebuchten Erstattungsbetrag dieser Charge — so werden mehrere
        // Teil-Refunds korrekt summiert und Re-Deliveries nicht doppelt verbucht.
        const refundEur = (charge.amount_refunded || 0) / 100;
        if (buchungId && refundEur > 0) {
          const bereitsErstattet = -(await gebuchteSummeMitQuelle(buchungId, `refund-${charge.id}`));
          const delta = Math.round((refundEur - bereitsErstattet) * 100) / 100;
          if (delta > 0.005) {
            // Erstattung als NEGATIVE Einnahme gegenbuchen: die ursprüngliche Zahlung wurde
            // beim Eingang als Einnahme verbucht (Zuflussprinzip), der Rückfluss reduziert sie.
            // Storno_Betrag_Eur wird NICHT überschrieben (= Stornogebühr).
            await bucheEinnahme({
              buchungId,
              quelle: `refund-${charge.id}-${charge.amount_refunded}`,
              betragEur: -delta,
              datum: new Date().toISOString().slice(0, 10),
              beschreibung: `Erstattung (Storno) Buchung #${buchungId}`,
            });
            await logAudit(buchungId, "Sonstiges", {
              event: "stripe_refund",
              charge_id: charge.id,
              refunded_eur: refundEur,
              delta_eur: delta,
            });
          }
        } else if (!buchungId && refundEur > 0) {
          // buchung_id nicht auffindbar: NICHT still verschlucken — Reconciliation-Eintrag,
          // damit die Erstattung manuell zugeordnet werden kann.
          await logAudit(0, "Sonstiges", {
            event: "refund_unzugeordnet",
            charge_id: charge.id,
            payment_intent: typeof charge.payment_intent === "string" ? charge.payment_intent : undefined,
            refunded_eur: refundEur,
          });
        }
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
