import type { MailText } from "../types";

/**
 * Deposit mails.
 *
 * NOTE for whoever reads this next: the two texts below contradict each other.
 * `kaution_hold_link` describes the deposit as a Stripe pre-authorisation ("we do
 * NOT charge it"), `kaution_bar_hinweis` asks the customer to bring cash. Both can
 * reach the same customer for the same booking.
 *
 * They are extracted here UNCHANGED on purpose. Fixing customer text is a separate,
 * individually approved step — the overview at /admin/vorlagen exists to make exactly
 * this kind of contradiction visible first.
 */

export interface KautionHoldCtx {
  vorname: string;
  nachname: string;
  amount: number;
  kautionUrl: string;
  meinBereichUrl: string | null;
}

/** Asks the customer to place the deposit as a Stripe hold. */
export function buildKautionHoldLink(ctx: KautionHoldCtx): MailText {
  const { vorname, nachname, amount, kautionUrl, meinBereichUrl } = ctx;
  const greeting = `Hallo ${vorname} ${nachname}`.trim();
  const amountFmt = amount.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const memberBlock = meinBereichUrl
    ? `\n\nMein Bereich (Buchungs-Status + Zahlungen + Rechnungen):\n${meinBereichUrl}`
    : "";

  return {
    subject: "Kaution hinterlegen | Eventverleih Bergstraße",
    body: `${greeting},

vor der Übergabe brauchen wir Ihre Kaution als Sicherheit. **Wir buchen die Kaution NICHT ab** — Stripe blockiert den Betrag nur auf Ihrer Karte (sogenannte Pre-Authorization). Bei Rückgabe ohne Schäden wird der Hold automatisch aufgelöst, es fließt kein Geld.

Kautions-Betrag: ${amountFmt} EUR

Bitte hier hinterlegen:
${kautionUrl}

Wichtiges in Kürze:
  * Karte wird geprüft + Betrag vorgemerkt (kein Abbuchen)
  * Hold ist standardmäßig 7 Tage aktiv. Bei Visa/Mastercard verlängert Stripe ggf. auf bis zu 30 Tage automatisch.
  * Bei Rückgabe ohne Schäden: Auflösung des Holds in der Regel innerhalb 1-3 Werktagen.
  * Falls beim Hinterlegen etwas klemmt, melden Sie sich kurz — dann finden wir gemeinsam eine Lösung.${memberBlock}

Bei Fragen jederzeit per WhatsApp oder Anruf erreichbar: +49 156 79521124.

Mit freundlichen Grüßen
Manuel Büttner

Eventverleih Bergstraße
Schlesierstraße 19a, 64665 Alsbach-Hähnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`,
  };
}

export interface KautionBarCtx {
  kundeName: string;
  kautionSoll: number;
  /** Days until the event; 0 or 1 renders as "Kürze". */
  tageBis: number;
}

/**
 * Reminder to bring the deposit in cash, sent automatically (Auto_Reply) a few days
 * before the event. Contradicts the Stripe-first rule — see the note at the top.
 */
export function buildKautionBarHinweis(ctx: KautionBarCtx): MailText {
  const { kundeName, kautionSoll, tageBis } = ctx;
  const betrag = kautionSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    subject: "Kaution zur Übergabe | Eventverleih Bergstraße",
    body:
      `Hallo ${kundeName},\n\n` +
      `zur Vorbereitung auf Ihre Übergabe in ${tageBis <= 1 ? "Kürze" : `ca. ${tageBis} Tagen`}: ` +
      `Bitte denken Sie daran, die Kaution (${betrag} EUR) bar bei der Übergabe mitzubringen.\n\n` +
      `Die Kaution erhalten Sie nach der Rückgabe ohne Schäden vollständig zurück.\n\n` +
      `Bei Fragen jederzeit per WhatsApp oder Anruf: +49 156 79521124.\n\n` +
      `Viele Grüße\nManuel Büttner — Eventverleih Bergstraße`,
  };
}
