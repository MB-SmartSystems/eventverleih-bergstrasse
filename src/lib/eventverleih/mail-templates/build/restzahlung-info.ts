import type { MailText } from "../types";
import { formatGermanShort, BAR_ZAHLUNG_HINWEIS } from "@/lib/eventverleih/constants";

export interface RestzahlungInfoCtx {
  kundeName: string;
  restSoll: number;
  eventDatumVon: string;
  stripeLink: string | null;
  meinBereichUrl: string | null;
}

/**
 * Übergabe-Info, 3 Tage vor dem Event (Entscheidung 2026-07-23, A5).
 * Bewusst KEINE Zahlungsaufforderung und kein "fällig": die Restzahlung ist spätestens
 * bei der Übergabe zu leisten (AGB §3), Zug um Zug. Diese Mail ist reine Vorbereitung
 * auf die Übergabe. Wer mag, zahlt vorab online (am bequemsten); bar zur Übergabe bleibt
 * möglich, dann mit den zwei Pflicht-Hinweisen.
 */
export function buildRestzahlungInfo(ctx: RestzahlungInfoCtx): MailText {
  const { kundeName, restSoll, eventDatumVon, stripeLink, meinBereichUrl } = ctx;

  const linkLine = stripeLink
    ? `Falls Sie vorab online zahlen möchten, geht das am bequemsten hier:\n${stripeLink}\n\nAlternativ auch per PayPal an info@eventverleih-bergstrasse.de (bitte „Waren & Dienstleistungen" wählen, nicht „Freunde & Familie").\n\n`
    : `Falls Sie vorab online zahlen möchten, geht das bequem über Ihren Kundenbereich (Link unten) oder per PayPal an info@eventverleih-bergstrasse.de (bitte „Waren & Dienstleistungen" wählen).\n\n`;
  const memberBlock = meinBereichUrl
    ? `\nIhren aktuellen Buchungsstatus + alle Zahlungs-Links sehen Sie hier:\n${meinBereichUrl}\n`
    : "";
  const sig = `\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

  const datum = formatGermanShort(eventDatumVon);
  const betragFmt = restSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const opening = `Ihr Event am ${datum} steht vor der Tür, wir freuen uns drauf.`;

  const core =
    `Kurz zur Vorbereitung auf die Übergabe: Falls die Restzahlung (${betragFmt} EUR) noch offen ist, ` +
    `können Sie sie vorab online zahlen oder zur Übergabe mitbringen. ` +
    `${BAR_ZAHLUNG_HINWEIS}`;

  const pscript = `Falls die Restzahlung schon raus ist und sich nur überschnitten hat, ignorieren Sie die Mail einfach.`;

  return {
    subject: `Ihr Event am ${datum}: kurze Info zur Übergabe`,
    body: `Hallo ${kundeName},\n\n${opening}\n\n${core}\n\n${linkLine}${pscript}${memberBlock}${sig}`,
  };
}
