/**
 * Termin-Erinnerung — erinnert ~1 Tag vor der Übergabe an Datum/Uhrzeit/Treffpunkt,
 * inkl. Kaution-Hinweis (Barzahlung bei Übergabe), falls die Kaution noch offen ist.
 *
 * Als LIB (KEIN eigener Vercel-Cron — Hobby-Plan limitiert Crons), Sub-Pass im
 * restzahlung-reminder-Cron (morgens). Idempotent je Buchung (B<id>-termin_erinnerung).
 * Approval_Status=Auto_Reply → wird automatisch versendet.
 *
 * Zeitangabe IMMER in Europe/Berlin formatieren (Server läuft UTC).
 */
import { listAllRows, listRows, getRow, createRow, TABLES } from "@/lib/baserow/client";
import { uebergabeOrt } from "@/lib/eventverleih/config";

const TZ = "Europe/Berlin";

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Uebergabe_Termin: string | null;
  Rueckgabe_Termin: string | null;
  Uebergabe_Adresse: string | null;
  Lieferadresse: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Übergabe_Typ: { value: string } | null;
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Stripe_Kaution_Link: string | null;
  Restzahlung_Soll_Eur: string | number | null;
  Restzahlung_Bezahlt_am: string | null;
  Stripe_Restzahlung_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/** YYYY-MM-DD in Berlin-Zeit. */
function berlinDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** „Mittwoch, 03.06.2026 um 11:00 Uhr" in Berlin-Zeit. */
function berlinDateTime(iso: string): string {
  const d = new Date(iso);
  const s = d.toLocaleString("de-DE", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${s} Uhr`;
}

export async function runTerminReminder(): Promise<{
  pruefte: number;
  mails: number;
  skipped_duplicate: number;
  fehler: number;
}> {
  const result = { pruefte: 0, mails: 0, skipped_duplicate: 0, fehler: 0 };
  const all = await listAllRows<BuchungRow>(TABLES.Buchungen);
  const morgen = berlinDate(new Date(Date.now() + 86_400_000));

  for (const b of all.results) {
    const status = b.Status_Erweitert?.value || "";
    if (status !== "Bestaetigt" && status !== "Reserviert") continue;
    if (!b.Uebergabe_Termin) continue;
    // Übergabe ist morgen (Berlin-Datum)?
    if (berlinDate(new Date(b.Uebergabe_Termin)) !== morgen) continue;

    result.pruefte++;

    const idemKey = `B${b.id}-termin_erinnerung`;
    const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, {
      search: idemKey,
      size: 5,
    });
    if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
      result.skipped_duplicate++;
      continue;
    }

    const kundeId = b.Kunde_Link?.[0]?.id;
    if (!kundeId) continue;
    let kunde: { Vorname?: string; Nachname?: string; Email?: string };
    try {
      kunde = await getRow<{ Vorname?: string; Nachname?: string; Email?: string }>(TABLES.Kunden, kundeId);
    } catch {
      continue;
    }
    if (!kunde.Email) continue;
    const kundeName = `${kunde.Vorname ?? ""} ${kunde.Nachname ?? ""}`.trim();

    const terminText = berlinDateTime(b.Uebergabe_Termin);
    const ort = uebergabeOrt(b, "uebergabe");

    // Restzahlung-Hinweis nur, wenn offen — fällig erst bei Übergabe, vorab = Komfort-Option
    const restSoll = parseDec(b.Restzahlung_Soll_Eur);
    const restOffen = restSoll > 0 && !b.Restzahlung_Bezahlt_am;
    let restBlock = "";
    if (restOffen) {
      const restBetrag = restSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const restLink = (b.Stripe_Restzahlung_Link || "").trim();
      restBlock =
        `\n\nDie Restzahlung (${restBetrag} EUR) ist spätestens zur Übergabe fällig — ` +
        `am einfachsten vorab bequem online.` +
        (restLink ? `\nIhr Zahlungslink:\n${restLink}` : "");
    }

    // Kaution-Hinweis: Barzahlung bei Übergabe (kein Stripe mehr)
    const kautionSoll = parseDec(b.Kaution_Soll_Eur);
    const kautionOffen = kautionSoll > 0 && !b.Kaution_Hinterlegt_am;
    let kautionBlock = "";
    if (kautionOffen) {
      const betrag = kautionSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      kautionBlock =
        `\n\nBitte denken Sie an die Kaution (${betrag} EUR) — diese wird bar bei der Übergabe erhoben ` +
        `und nach der Rückgabe ohne Schäden vollständig zurückgegeben.`;
    }

    const subject = "Erinnerung an Ihren Übergabe-Termin morgen";
    const body =
      `Hallo ${kundeName},\n\n` +
      `eine kurze Erinnerung an unseren Übergabe-Termin:\n` +
      `${terminText}\n${ort}.` +
      `${restBlock}${kautionBlock}\n\n` +
      `Falls etwas dazwischenkommt, geben Sie mir bitte kurz Bescheid.\n\n` +
      `Viele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [b.id],
        Kunde_Link: [kundeId],
        Template_Key: "termin_erinnerung",
        Subject: subject,
        Body: body,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: idemKey,
      });
      result.mails++;
    } catch (e) {
      result.fehler++;
      console.error("[termin-reminder] mail-insert fehlgeschlagen:", e);
    }
  }

  // ----- RÜCKGABE-Erinnerung (Vortag) -----
  for (const b of all.results) {
    const status = b.Status_Erweitert?.value || "";
    if (status !== "In_Miete" && status !== "Uebergeben") continue;
    if (!b.Rueckgabe_Termin) continue;
    if (berlinDate(new Date(b.Rueckgabe_Termin)) !== morgen) continue;

    result.pruefte++;
    const idemKey = `B${b.id}-rueckgabe_erinnerung`;
    const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, {
      search: idemKey,
      size: 5,
    });
    if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
      result.skipped_duplicate++;
      continue;
    }

    const kundeId = b.Kunde_Link?.[0]?.id;
    if (!kundeId) continue;
    let kunde: { Vorname?: string; Nachname?: string; Email?: string };
    try {
      kunde = await getRow<{ Vorname?: string; Nachname?: string; Email?: string }>(TABLES.Kunden, kundeId);
    } catch {
      continue;
    }
    if (!kunde.Email) continue;
    const kundeName = `${kunde.Vorname ?? ""} ${kunde.Nachname ?? ""}`.trim();
    const terminText = berlinDateTime(b.Rueckgabe_Termin);
    const ort = uebergabeOrt(b, "rueckgabe");

    const body =
      `Hallo ${kundeName},\n\n` +
      `eine kurze Erinnerung an unseren Rückgabe-Termin:\n` +
      `${terminText}\n${ort}.\n\n` +
      `Bitte bringen Sie die Artikel vollständig und sauber zurück. ` +
      `Die Kaution erstatte ich nach kurzer Prüfung.\n\n` +
      `Falls etwas dazwischenkommt, geben Sie mir bitte kurz Bescheid.\n\n` +
      `Viele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [b.id],
        Kunde_Link: [kundeId],
        Template_Key: "rueckgabe_erinnerung",
        Subject: "Erinnerung an Ihren Rückgabe-Termin morgen",
        Body: body,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: idemKey,
      });
      result.mails++;
    } catch (e) {
      result.fehler++;
      console.error("[termin-reminder] rückgabe mail-insert fehlgeschlagen:", e);
    }
  }

  return result;
}
