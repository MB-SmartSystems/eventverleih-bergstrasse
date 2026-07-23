import type { MailText } from "../types";
import { formatGermanShort } from "@/lib/eventverleih/constants";

export interface RestzahlungInfoCtx {
  kundeName: string;
  restSoll: number;
  eventDatumVon: string;
  stripeLink: string | null;
  meinBereichUrl: string | null;
}

/**
 * Service note about the remaining payment, 3 days before the event.
 * Deliberately NOT a payment demand: the remaining amount is due at handover
 * (AGB §3). Paying online beforehand is offered as convenience only.
 */
export function buildRestzahlungInfo(ctx: RestzahlungInfoCtx): MailText {
  const { kundeName, restSoll, eventDatumVon, stripeLink, meinBereichUrl } = ctx;

  const linkLine = stripeLink
    ? `Vorab online geht am bequemsten hier:\n${stripeLink}\n\nAlternativ auch per PayPal an info@eventverleih-bergstrasse.de möglich (bitte „Waren & Dienstleistungen" wählen, nicht „Freunde & Familie").\n\n`
    : `Vorab online geht bequem über Ihren Kundenbereich (Link unten) oder per PayPal an info@eventverleih-bergstrasse.de (bitte „Waren & Dienstleistungen" wählen).\n\n`;
  const memberBlock = meinBereichUrl
    ? `\nIhren aktuellen Buchungsstatus + alle Zahlungs-Links sehen Sie hier:\n${meinBereichUrl}\n`
    : "";
  const sig = `\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

  const datum = formatGermanShort(eventDatumVon);
  const betragFmt = restSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const opening = `Ihr Event am ${datum} steht vor der Tür — wir freuen uns drauf.`;

  const core =
    `Kurz zur Info: Die Restzahlung von ${betragFmt} EUR ist spätestens zur Übergabe fällig. ` +
    `Am einfachsten vorab online oder alternativ bar bei der Übergabe.`;

  const pscript = `Falls die Restzahlung schon raus ist und sich nur überschnitten hat — alles gut, ignorieren Sie die Mail einfach.`;

  return {
    subject: `Ihr Event am ${datum} — kurze Info zur Restzahlung`,
    body: `Hallo ${kundeName},\n\n${opening}\n\n${core}\n\n${linkLine}${pscript}${memberBlock}${sig}`,
  };
}
