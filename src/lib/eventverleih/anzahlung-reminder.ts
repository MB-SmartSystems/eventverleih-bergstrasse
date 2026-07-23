/**
 * Anzahlungs-Reminder-Logik (Hobby-Plan: kein eigener Cron — wird vom
 * restzahlung-reminder-Cron mit-ausgeführt, beide laufen morgens).
 *
 * Schließt die "Bestätigt aber nie bezahlt"-Lücke: bestätigte Buchungen ohne
 * Anzahlungseingang versanden sonst lautlos (Stripe-Webhook setzt erst BEI Zahlung
 * auf Reserviert). KEIN Auto-Storno (first-to-pay-wins, weich) — Manuel entscheidet.
 *
 * Ton: freundliche Info, KEINE Mahnung. Wording vermittelt "Termin ist vorgemerkt,
 * verbindlich-eingebucht erst mit Anzahlung — first-to-pay-wins". Alle Stufen tragen
 * denselben Ton; nur der Eingangs-Satz variiert je Trigger.
 *
 * Sicherheits-Gate: Mails landen mit Approval_Status="Pending" in MailQueue und
 * gehen erst nach Manuel-Freigabe raus. Falls Anzahlung tatsächlich schon
 * eingegangen ist (Bank-Überweisung, noch nicht im Dashboard quittiert), wird
 * die Pending-Mail im /guten-morgen via Trigger-Phrase gecancelt.
 */
import { listAllRows, listRows, createRow, getRow, TABLES } from "@/lib/baserow/client";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { formatGermanShort } from "@/lib/eventverleih/constants";
import { buildAnzahlungErinnerung } from "@/lib/eventverleih/mail-templates/build/anzahlung-erinnerung";

interface BuchungRow {
  id: number;
  Buchung_ID?: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Anzahlung_Soll_Eur: string | number | null;
  Anzahlung_Bezahlt_am: string | null;
  Stripe_Anzahlung_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
  Angebote: Array<{ id: number; value: string }> | null;
}

interface AngebotRow {
  id: number;
  Akzeptiert_am: string | null;
}

/**
 * Trigger-Stufen — Priorisierung absteigend (näher am Event = wichtiger).
 * Bei Mehrfach-Match an einem Tag (z.B. Buchung 7 Tage vor Event mit Akzept vor 3 Tagen
 * matched sowohl pre7 als auch post3) gewinnt der FRUEHESTE Eintrag dieser Liste.
 */
const STUFEN = [
  { tpl: "anzahlung_pre3", art: "pre_event" as const, tage: 3 },
  { tpl: "anzahlung_pre7", art: "pre_event" as const, tage: 7 },
  { tpl: "anzahlung_pre14", art: "pre_event" as const, tage: 14 },
  { tpl: "anzahlung_post3", art: "post_bestaetigt" as const, tage: 3 },
];

function daysBetween(future: string): number {
  const d = new Date(future);
  if (isNaN(d.getTime())) return -1;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function daysSince(past: string): number {
  const d = new Date(past);
  if (isNaN(d.getTime())) return -1;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}


export async function runAnzahlungReminder(): Promise<Record<string, unknown>> {
  const result = { pruefte: 0, mails_versendet: 0, skipped_duplicate: 0, skipped_bezahlt_inzwischen: 0, fehler: 0 };

  const all = await listAllRows<BuchungRow>(TABLES.Buchungen);
  for (const b of all.results) {
    if ((b.Status_Erweitert?.value || "") !== "Bestaetigt") continue;
    if (b.Anzahlung_Bezahlt_am) continue;
    if (!b.Event_datum_von) continue;
    const anzahlungSoll = parseDec(b.Anzahlung_Soll_Eur);
    if (anzahlungSoll <= 0) continue;

    result.pruefte++;

    // Trigger-Match: alle passenden Stufen sammeln, hoechst-priorisierte (= erste in STUFEN) gewinnt.
    const tageBis = daysBetween(b.Event_datum_von);
    let akzeptAm: string | null = null;
    const angebotId = b.Angebote?.[0]?.id;
    if (angebotId) {
      try {
        const ang = await getRow<AngebotRow>(TABLES.Angebote, angebotId);
        akzeptAm = ang.Akzeptiert_am;
      } catch (e) {
        console.error("[anzahlung-reminder] angebot-fetch fehlgeschlagen:", e);
      }
    }
    const tageSeitBest = akzeptAm ? daysSince(akzeptAm) : -1;

    const stufe = STUFEN.find((s) => {
      if (s.art === "pre_event") return tageBis === s.tage;
      return tageSeitBest === s.tage;
    });
    if (!stufe) continue;

    const idemKey = `B${b.id}-${stufe.tpl}`;
    const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, { search: idemKey, size: 5 });
    if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
      result.skipped_duplicate++;
      continue;
    }

    // Sicherheits-Pre-Check direkt vor createRow: frisches getRow, falls Stripe-Webhook
    // oder Manuel-Quittierung zwischen listAllRows und hier passiert ist.
    try {
      const fresh = await getRow<BuchungRow>(TABLES.Buchungen, b.id);
      if (fresh.Anzahlung_Bezahlt_am) {
        result.skipped_bezahlt_inzwischen++;
        continue;
      }
    } catch (e) {
      console.error("[anzahlung-reminder] pre-check getRow fehlgeschlagen:", e);
    }

    const kundeId = b.Kunde_Link?.[0]?.id;
    if (!kundeId) continue;
    let kundeName = "";
    try {
      const k = await getRow<{ Vorname?: string; Nachname?: string }>(TABLES.Kunden, kundeId);
      kundeName = `${k?.Vorname ?? ""} ${k?.Nachname ?? ""}`.trim();
    } catch (e) {
      console.error("[anzahlung-reminder] kunde-fetch fehlgeschlagen:", e);
    }
    if (!kundeName) continue;

    let meinBereichUrl: string | null = null;
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[anzahlung-reminder] member-token fehlgeschlagen:", e);
    }

    const mail = buildAnzahlungErinnerung({
      tpl: stufe.tpl,
      kundeName,
      anzahlungSoll,
      eventDatumVon: b.Event_datum_von,
      stripeLink: b.Stripe_Anzahlung_Link,
      meinBereichUrl,
    });

    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [b.id],
        Kunde_Link: [kundeId],
        Template_Key: stufe.tpl,
        Subject: mail.subject,
        Body: mail.body,
        Approval_Status: "Pending",
        Idempotency_Key: idemKey,
      });
      result.mails_versendet++;
    } catch (e) {
      result.fehler++;
      console.error("[anzahlung-reminder] mail-insert fehlgeschlagen:", e);
    }
  }

  return result;
}
