import type { MailText } from "../types";

/**
 * Appointment reminders.
 *
 * These carry the conditional blocks that make several example cases necessary in
 * the overview: the payment and deposit paragraphs only appear when something is
 * still open. With a fully paid example booking they would be invisible — which is
 * exactly how the cash wording in `termin_erinnerung` stayed unnoticed for weeks.
 */

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function eur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface TerminErinnerungCtx {
  kundeName: string;
  /** Already formatted in Europe/Berlin, e.g. "Mittwoch, 03.06.2026 um 11:00 Uhr". */
  terminText: string;
  /** Handover location, already resolved. */
  ort: string;
  restSoll: string | number | null;
  restBezahltAm: string | null;
  restLink: string | null;
  kautionSoll: string | number | null;
  kautionHinterlegtAm: string | null;
}

/** Reminder the day before the handover. */
export function buildTerminErinnerung(ctx: TerminErinnerungCtx): MailText {
  const { kundeName, terminText, ort } = ctx;

  const restSoll = parseDec(ctx.restSoll);
  const restOffen = restSoll > 0 && !ctx.restBezahltAm;
  let restBlock = "";
  if (restOffen) {
    const restBetrag = restSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const restLink = (ctx.restLink || "").trim();
    restBlock =
      `\n\nDie Restzahlung (${restBetrag} EUR) ist spätestens zur Übergabe fällig — ` +
      `am einfachsten vorab bequem online.` +
      (restLink ? `\nIhr Zahlungslink:\n${restLink}` : "");
  }

  const kautionSoll = parseDec(ctx.kautionSoll);
  const kautionOffen = kautionSoll > 0 && !ctx.kautionHinterlegtAm;
  let kautionBlock = "";
  if (kautionOffen) {
    const betrag = kautionSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    kautionBlock =
      `\n\nBitte denken Sie an die Kaution (${betrag} EUR) — diese wird bar bei der Übergabe erhoben ` +
      `und nach der Rückgabe ohne Schäden vollständig zurückgegeben.`;
  }

  return {
    subject: "Erinnerung an Ihren Übergabe-Termin morgen",
    body:
      `Hallo ${kundeName},\n\n` +
      `eine kurze Erinnerung an unseren Übergabe-Termin:\n` +
      `${terminText}\n${ort}.` +
      `${restBlock}${kautionBlock}\n\n` +
      `Falls etwas dazwischenkommt, geben Sie mir bitte kurz Bescheid.\n\n` +
      `Viele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
  };
}

export interface RueckgabeErinnerungCtx {
  kundeName: string;
  terminText: string;
  ort: string;
}

/** Reminder the day before the return. */
export function buildRueckgabeErinnerung(ctx: RueckgabeErinnerungCtx): MailText {
  const { kundeName, terminText, ort } = ctx;
  return {
    subject: "Erinnerung an Ihren Rückgabe-Termin morgen",
    body:
      `Hallo ${kundeName},\n\n` +
      `eine kurze Erinnerung an unseren Rückgabe-Termin:\n` +
      `${terminText}\n${ort}.\n\n` +
      `Bitte bringen Sie die Artikel vollständig und sauber zurück. ` +
      `Die Kaution erstatte ich nach kurzer Prüfung.\n\n` +
      `Falls etwas dazwischenkommt, geben Sie mir bitte kurz Bescheid.\n\n` +
      `Viele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
  };
}

export interface OffeneBetraegeCtx {
  restSoll: string | number | null;
  restBezahltAm: string | null;
  restLink: string | null;
  kautionSoll: string | number | null;
  kautionHinterlegtAm: string | null;
  kautionLink: string | null;
}

/**
 * Note about amounts still open — handover only, and only when Baserow records no
 * payment. Stripe is the standard way here; cash is deliberately NOT offered.
 */
export function offeneBetraegeBlock(ctx: OffeneBetraegeCtx): string {
  const restSoll = parseDec(ctx.restSoll);
  const kautSoll = parseDec(ctx.kautionSoll);
  const restOffen = restSoll > 0 && !ctx.restBezahltAm;
  const kautOffen = kautSoll > 0 && !ctx.kautionHinterlegtAm;
  if (!restOffen && !kautOffen) return "";

  const posten: string[] = [];
  if (restOffen) posten.push(`Restzahlung ${eur(restSoll)} EUR`);
  if (kautOffen) posten.push(`Kaution ${eur(kautSoll)} EUR`);

  const links = [
    restOffen && ctx.restLink ? ctx.restLink : null,
    kautOffen && ctx.kautionLink ? ctx.kautionLink : null,
  ].filter(Boolean);

  const linkZeile = links.length ? `\nHier direkt erledigen:\n${links.join("\n")}\n` : "";

  return `\nKurzer Hinweis: Offen ist noch ${posten.join(" und ")}. Am schnellsten erledigen Sie das vorab online.\n${linkZeile}`;
}

export interface Termin1hCtx {
  kundeName: string;
  /** "Übergabe" or "Rückgabe". */
  label: string;
  /** Already formatted in Europe/Berlin, e.g. "15:00 Uhr". */
  zeit: string;
  ort: string;
  /** Result of offeneBetraegeBlock, empty string when nothing is open. */
  zahlungsHinweis: string;
}

/** Short reminder roughly an hour before the appointment. */
export function buildTermin1h(ctx: Termin1hCtx): MailText {
  const { kundeName, label, zeit, ort, zahlungsHinweis } = ctx;
  return {
    subject: `Gleich: Ihr ${label}-Termin um ${zeit}`,
    body:
      `Hallo ${kundeName},\n\n` +
      `kurze Erinnerung: Unser ${label}-Termin ist gleich — um ${zeit}.\n${ort}.\n` +
      zahlungsHinweis +
      `\nBis gleich!\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
  };
}
