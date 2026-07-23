import type { MailText } from "../types";
import { formatGermanShort } from "@/lib/eventverleih/constants";

export interface AnzahlungErinnerungCtx {
  /** Stage key: anzahlung_post3 | anzahlung_pre7 (Entscheidung 2026-07-23: nur zwei Stufen). */
  tpl: string;
  kundeName: string;
  anzahlungSoll: number;
  eventDatumVon: string;
  stripeLink: string | null;
  meinBereichUrl: string | null;
}

/**
 * Friendly note: the reservation is not final until the deposit arrives.
 * Same tone for all four stages, only the opening sentence differs.
 */
export function buildAnzahlungErinnerung(ctx: AnzahlungErinnerungCtx): MailText {
  const { tpl, kundeName, anzahlungSoll, eventDatumVon, stripeLink, meinBereichUrl } = ctx;

  const linkLine = stripeLink
    ? `Am bequemsten online (sofort eingebucht):\n${stripeLink}\n\nAlternativ auch per PayPal an info@eventverleih-bergstrasse.de möglich (bitte „Waren & Dienstleistungen" wählen, nicht „Freunde & Familie").\n\n`
    : `Den Zahlungslink finden Sie in Ihrem Kundenbereich (Link unten), oder melden Sie sich kurz, ich schicke ihn Ihnen direkt. Alternativ auch per PayPal an info@eventverleih-bergstrasse.de (bitte „Waren & Dienstleistungen" wählen).\n\n`;
  const memberBlock = meinBereichUrl
    ? `\nIhren Buchungsstatus + alle Zahlungs-Links sehen Sie hier:\n${meinBereichUrl}\n`
    : "";
  const sig = `\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

  const datum = formatGermanShort(eventDatumVon);
  const betragFmt = anzahlungSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let opening = "";
  if (tpl === "anzahlung_pre7") {
    opening = `Ihr Event am ${datum} ist in einer Woche. Ihr Termin ist bei mir vorgemerkt.`;
  } else {
    // anzahlung_post3 (und alle uebrigen Faelle): kurz nach der Bestaetigung.
    opening = `vielen Dank für Ihre Bestätigung. Ihr Termin am ${datum} ist bei mir vorgemerkt.`;
  }

  const core = `Damit ich die Teile fest für Sie einbuchen kann, brauche ich noch die Anzahlung von ${betragFmt} EUR. So sichern Sie sich Ihre Reservierung. Bis die Anzahlung da ist, halte ich die Artikel zwar für Sie vor, kann sie aber noch nicht fest einbuchen. Zahlt in der Zwischenzeit jemand anderes schneller, hätte er Vorrang.`;

  const pscript = `Falls die Anzahlung schon raus ist und sich nur überschnitten hat, ignorieren Sie die Mail einfach.`;

  return {
    subject: `Kurze Info zu Ihrer Buchung am ${datum}`,
    body: `Hallo ${kundeName},\n\n${opening}\n\n${core}\n\n${linkLine}${pscript}${memberBlock}${sig}`,
  };
}
