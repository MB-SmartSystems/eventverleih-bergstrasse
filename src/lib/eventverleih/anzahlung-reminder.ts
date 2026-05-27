/**
 * Anzahlungs-Reminder-Logik (Hobby-Plan: kein eigener Cron — wird vom
 * restzahlung-reminder-Cron mit-ausgefuehrt, beide laufen morgens).
 *
 * Schliesst die "Bestaetigt aber nie bezahlt"-Luecke: bestaetigte Buchungen ohne
 * Anzahlungseingang versanden sonst lautlos (Stripe-Webhook setzt erst BEI Zahlung
 * auf Reserviert). KEIN Auto-Storno (first-to-pay-wins, weich) — Manuel entscheidet.
 */
import { listAllRows, listRows, createRow, TABLES } from "@/lib/baserow/client";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";

interface BuchungRow {
  id: number;
  Buchung_ID?: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Anzahlung_Soll_Eur: string | number | null;
  Anzahlung_Bezahlt_am: string | null;
  Stripe_Anzahlung_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

const STUFEN = [
  { tage: 14, tpl: "anzahlung_T14", tone: "freundlich" as const },
  { tage: 7, tpl: "anzahlung_T7", tone: "dringender" as const },
  { tage: 3, tpl: "anzahlung_T3", tone: "letzte_chance" as const },
];

function daysBetween(future: string): number {
  const d = new Date(future);
  if (isNaN(d.getTime())) return -1;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function buildMail(
  tone: "freundlich" | "dringender" | "letzte_chance",
  kundeName: string,
  anzahlungSoll: number,
  eventDatumVon: string,
  stripeLink: string | null,
  meinBereichUrl: string | null,
): { subject: string; body: string } {
  const linkLine = stripeLink
    ? `Am bequemsten zahlen Sie online:\n${stripeLink}\n\n`
    : `Bitte überweisen Sie auf:\n   IBAN: DE84 5001 0517 5420 4742 10\n   Verwendungszweck: bitte Angebotsnummer angeben.\n\n`;
  const memberBlock = meinBereichUrl ? `\nIhren Buchungsstatus + alle Zahlungs-Links sehen Sie hier:\n${meinBereichUrl}\n` : "";
  const sig = `\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

  if (tone === "freundlich") {
    return {
      subject: "Erinnerung: Anzahlung zur Reservierung Ihrer Buchung",
      body: `Hallo ${kundeName},\n\nvielen Dank für Ihre Bestätigung. Ihr Termin am ${eventDatumVon} ist für Sie vorgemerkt — verbindlich reserviert wird er mit Eingang der Anzahlung von ${anzahlungSoll.toFixed(2)} EUR.\n\n${linkLine}So ist der Termin sicher für Sie geblockt.${memberBlock}${sig}`,
    };
  }
  if (tone === "dringender") {
    return {
      subject: "Anzahlung Ihrer Buchung — Termin in einer Woche",
      body: `Hallo ${kundeName},\n\nIhr Event ist in einer Woche (${eventDatumVon}). Die Anzahlung von ${anzahlungSoll.toFixed(2)} EUR ist noch offen — erst damit ist der Termin verbindlich für Sie reserviert.\n\n${linkLine}Bitte zeitnah, damit Ihnen die Artikel sicher zur Verfügung stehen.${memberBlock}${sig}`,
    };
  }
  return {
    subject: "WICHTIG: Anzahlung Ihrer Buchung — Termin in 3 Tagen",
    body: `Hallo ${kundeName},\n\nIhr Event findet in 3 Tagen statt (${eventDatumVon}), die Anzahlung von ${anzahlungSoll.toFixed(2)} EUR ist noch nicht eingegangen.\n\nBitte leisten Sie die Anzahlung heute, damit ich den Termin verbindlich für Sie reservieren kann — ohne Anzahlung kann ich die Artikel nicht garantieren.\n\n${linkLine}${memberBlock}${sig}`,
  };
}

export async function runAnzahlungReminder(): Promise<Record<string, unknown>> {
  const result = { pruefte: 0, mails_versendet: 0, skipped_duplicate: 0, fehler: 0 };

  const all = await listAllRows<BuchungRow>(TABLES.Buchungen);
  for (const b of all.results) {
    if ((b.Status_Erweitert?.value || "") !== "Bestaetigt") continue;
    if (b.Anzahlung_Bezahlt_am) continue;
    if (!b.Event_datum_von) continue;
    const anzahlungSoll = parseDec(b.Anzahlung_Soll_Eur);
    if (anzahlungSoll <= 0) continue;

    result.pruefte++;
    const tageBis = daysBetween(b.Event_datum_von);
    const stufe = STUFEN.find((s) => s.tage === tageBis);
    if (!stufe) continue;

    const idemKey = `B${b.id}-${stufe.tpl}`;
    const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, { search: idemKey, size: 5 });
    if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
      result.skipped_duplicate++;
      continue;
    }

    const kundeId = b.Kunde_Link?.[0]?.id;
    const kundeName = b.Kunde_Link?.[0]?.value || "";
    if (!kundeId) continue;

    let meinBereichUrl: string | null = null;
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[anzahlung-reminder] member-token fehlgeschlagen:", e);
    }

    const mail = buildMail(stufe.tone, kundeName, anzahlungSoll, b.Event_datum_von, b.Stripe_Anzahlung_Link, meinBereichUrl);

    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [b.id],
        Kunde_Link: [kundeId],
        Template_Key: stufe.tpl,
        Subject: mail.subject,
        Body: mail.body,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: idemKey,
      });
      result.mails_versendet++;
    } catch (e) {
      result.fehler++;
      console.error("[anzahlung-reminder] mail-insert fehlgeschlagen:", e);
    }

    if (stufe.tage === 3) {
      const notifyUrl = process.env.N8N_ANFRAGE_NOTIFY_URL || "";
      if (notifyUrl) {
        try {
          await fetch(notifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "anzahlung_offen_T3",
              buchung_id: b.id,
              buchung_nr: b.Buchung_ID,
              kunde_name: kundeName,
              anzahlung_eur: anzahlungSoll.toFixed(2),
              event_datum: b.Event_datum_von,
              hinweis: "Anzahlung 3 Tage vor Event noch offen — bestaetigte Buchung droht zu versanden",
            }),
            signal: AbortSignal.timeout(5000),
          });
        } catch (e) {
          console.error("[anzahlung-reminder] telegram-notify fehlgeschlagen:", e);
        }
      }
    }
  }

  return result;
}
