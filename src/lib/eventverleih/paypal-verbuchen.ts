/**
 * PayPal-Zahlungsverbuchung in Baserow — 1:1 spiegelbildlich zur Stripe-Webhook-Logik
 * (src/app/api/stripe/webhook/route.ts), aber ueber PayPal-Capture-IDs statt Stripe-PaymentIntents.
 *
 * Deckt Anzahlung / Restzahlung / Komplettzahlung ab (KEINE Kaution — bei PayPal bar/Ueberweisung).
 *
 * Idempotenz auf mehreren Ebenen:
 *   - Reservierungszahlung (anzahlung/komplett): Status-Guard (SCHON_VERARBEITET)
 *   - Restzahlung: Restzahlung_Bezahlt_am-Guard
 *   - Einnahme: bucheEinnahme ist ueber die Capture-ID (quelle) idempotent
 *   - Bestaetigungsmail: Idempotency_Key pro Buchung+Template
 * Zusaetzlich dedupt der Webhook-Handler auf PayPal-event.id-Ebene.
 *
 * Fail-soft in den Nebenpfaden (Mail, Konflikt-Check) — ein Fehler dort darf den
 * Webhook nicht in einen 500 kippen (sonst re-delivered PayPal endlos).
 */
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { listOpenStockConflicts } from "@/lib/eventverleih/conflicts";
import { invalidateAvailabilityCache } from "@/lib/eventverleih/availability";
import { kundeNameAusLink } from "@/lib/eventverleih/kunde-name";
import { queueAnzahlungErhaltenMail } from "@/lib/eventverleih/zahlungsbestaetigung";
import { bucheEinnahme } from "@/lib/eventverleih/einnahme";
import { buildKomplettzahlungErhalten, buildRestzahlungErhalten } from "@/lib/eventverleih/mail-templates/build/zahlung-erhalten";

export type PayPalPaymentType = "anzahlung" | "restzahlung" | "komplettzahlung";

async function logAudit(buchungId: number, aktion: string, details: Record<string, unknown>) {
  try {
    await createRow(TABLES.Audit_Log, {
      Name: `${aktion} Buchung #${buchungId}`,
      Aktion: aktion,
      Zeitpunkt: new Date().toISOString(),
      Buchung_ID_Ref: String(buchungId),
      Akteur: "PayPal-Webhook",
      Details: JSON.stringify(details),
      Aktiv: true,
    });
  } catch (e) {
    console.error("[paypal-audit-log]", aktion, e);
  }
}

const SCHON_VERARBEITET = new Set([
  "Reserviert",
  "Uebergeben",
  "In_Miete",
  "Zurueckgegeben",
  "Abgerechnet",
  "Storniert",
]);

function eurNum(v: string | number | null): number {
  return typeof v === "number" ? v : parseFloat(v ?? "0") || 0;
}

type ReservierungBuchung = {
  Status_Erweitert: { value: string } | null;
  Event_datum_bis: string | null;
  Anzahlung_Soll_Eur: string | number | null;
  Restzahlung_Soll_Eur: string | number | null;
};

async function verbucheReservierung(
  buchungId: number,
  captureId: string,
  ist: number,
  paymentType: "anzahlung" | "komplettzahlung",
): Promise<{ ok: true; note?: string }> {
  const buchung = await getRow<ReservierungBuchung>(TABLES.Buchungen, buchungId);
  const curStatus = buchung.Status_Erweitert?.value || "";
  if (SCHON_VERARBEITET.has(curStatus)) {
    return { ok: true, note: `bereits_verarbeitet:${curStatus}` };
  }

  const today = new Date().toISOString().slice(0, 10);
  const sollAnz = eurNum(buchung.Anzahlung_Soll_Eur);
  const sollRest = eurNum(buchung.Restzahlung_Soll_Eur);
  const patch: Record<string, unknown> = {
    Status_Erweitert: "Reserviert",
    Anzahlung_Bezahlt_am: today,
    Anzahlung_Bezahlt_Eur: paymentType === "komplettzahlung" ? sollAnz : ist,
  };
  if (paymentType === "komplettzahlung") {
    patch.Restzahlung_Bezahlt_am = today;
    patch.Restzahlung_Bezahlt_Eur = Math.round((ist - sollAnz) * 100) / 100;
  }
  if (buchung.Event_datum_bis) patch.Lock_Until = `${buchung.Event_datum_bis}T23:59:59Z`;
  await updateRow(TABLES.Buchungen, buchungId, patch);
  await logAudit(buchungId, "Anzahlung_eingegangen", {
    zahlweg: "paypal",
    payment_type: paymentType,
    paypal_capture: captureId,
    amount_eur: ist,
    new_status: "Reserviert",
    lock_until: buchung.Event_datum_bis,
  });

  const sollTotal = paymentType === "komplettzahlung" ? sollAnz + sollRest : sollAnz;
  if (Math.abs(ist - sollTotal) > 0.01) {
    await logAudit(buchungId, "Sonstiges", {
      event: "betrag_divergenz",
      zahlweg: "paypal",
      payment_type: paymentType,
      ist_eur: ist,
      soll_eur: sollTotal,
      paypal_capture: captureId,
    });
  }

  // Einnahme nach Zuflussprinzip — idempotent ueber die Capture-ID.
  await bucheEinnahme({
    buchungId,
    quelle: captureId,
    betragEur: ist,
    datum: today,
    beschreibung:
      paymentType === "komplettzahlung"
        ? `Komplettzahlung (Miete, PayPal) Buchung #${buchungId}`
        : `Anzahlung (PayPal) Buchung #${buchungId}`,
  });

  // Bestaetigungsmail (fail-soft, idempotent) — gleiche Idempotency_Keys wie Stripe → nie doppelt.
  try {
    const b = await getRow<{ Kunde_Link: Array<{ id: number; value: string }> | null }>(TABLES.Buchungen, buchungId);
    const kid = b.Kunde_Link?.[0]?.id;
    const kname = await kundeNameAusLink(b.Kunde_Link);
    if (kid && paymentType === "komplettzahlung") {
      const mailKomplett = buildKomplettzahlungErhalten({ kname });
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [buchungId],
        Kunde_Link: [kid],
        Template_Key: "komplettzahlung_erhalten",
        Subject: mailKomplett.subject,
        Body: mailKomplett.body,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-komplettzahlung_erhalten`,
      });
    } else if (kid && paymentType === "anzahlung") {
      await queueAnzahlungErhaltenMail(buchungId);
    }
  } catch (e) {
    console.error("[paypal-verbuchen] Bestätigungsmail fehlgeschlagen:", e);
  }

  // Mengen-genauer Engpass-Check → nur flaggen, nichts Destruktives.
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
        zahlweg: "paypal",
        artikel: mine.map((g) => `${g.artikel_name} (${g.nachgefragt}/${g.bestand})`),
        beteiligte_buchungen: beteiligte,
        hinweis: "Manuel-Entscheidung nötig - kein Auto-Storno/Refund",
      });
    }
  } catch (e) {
    console.error("[paypal-verbuchen] Engpass-Check fehlgeschlagen:", e);
  }

  invalidateAvailabilityCache();
  return { ok: true };
}

async function verbucheRestzahlung(
  buchungId: number,
  captureId: string,
  ist: number,
): Promise<{ ok: true; note?: string }> {
  const rb = await getRow<{ Restzahlung_Bezahlt_am: string | null }>(TABLES.Buchungen, buchungId);
  if (rb.Restzahlung_Bezahlt_am) {
    return { ok: true, note: "restzahlung_bereits_verbucht" };
  }
  await updateRow(TABLES.Buchungen, buchungId, {
    Restzahlung_Bezahlt_am: new Date().toISOString().slice(0, 10),
    Restzahlung_Bezahlt_Eur: ist,
  });
  await logAudit(buchungId, "Restzahlung_eingegangen", {
    zahlweg: "paypal",
    paypal_capture: captureId,
    amount_eur: ist,
  });
  await bucheEinnahme({
    buchungId,
    quelle: captureId,
    betragEur: ist,
    datum: new Date().toISOString().slice(0, 10),
    beschreibung: `Restzahlung (PayPal) Buchung #${buchungId}`,
  });
  try {
    const b = await getRow<{ Kunde_Link: Array<{ id: number; value: string }> | null }>(TABLES.Buchungen, buchungId);
    const kid = b.Kunde_Link?.[0]?.id;
    const kname = await kundeNameAusLink(b.Kunde_Link);
    if (kid) {
      const mailRest = buildRestzahlungErhalten({ kname });
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [buchungId],
        Kunde_Link: [kid],
        Template_Key: "restzahlung_erhalten",
        Subject: mailRest.subject,
        Body: mailRest.body,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-restzahlung_erhalten`,
      });
    }
  } catch (e) {
    console.error("[paypal-verbuchen] Restzahlung-Bestätigung fehlgeschlagen:", e);
  }
  return { ok: true };
}

/** Router: verbucht eine erfolgreiche PayPal-Capture je nach Zahlungsart. */
export async function verbuchePayPalZahlung(params: {
  buchungId: number;
  paymentType: PayPalPaymentType;
  captureId: string;
  amountEur: number;
}): Promise<{ ok: true; note?: string; processed?: string }> {
  const { buchungId, paymentType, captureId, amountEur } = params;
  if (paymentType === "anzahlung" || paymentType === "komplettzahlung") {
    const r = await verbucheReservierung(buchungId, captureId, amountEur, paymentType);
    return { ...r, processed: paymentType };
  }
  const r = await verbucheRestzahlung(buchungId, captureId, amountEur);
  return { ...r, processed: "restzahlung" };
}
