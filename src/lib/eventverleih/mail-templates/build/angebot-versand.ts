import type { MailText } from "../types";
import { SIGNATURE } from "./bausteine";
import { UEBERGABE_HINWEIS, formatGermanShort } from "@/lib/eventverleih/constants";

interface KundeName {
  Vorname: string;
  Nachname: string;
}

export interface AngebotErneutCtx {
  kunde: KundeName;
  preise: { preisArtikel: string; anzahlung: string; restzahlung: string; kaution: string };
  publicUrl: string;
  anmerkung?: string | null;
  meinBereichUrl: string | null;
}

/** The offer, sent again on request. Same price breakdown as the first send. */
export function buildAngebotErneutGesendet(ctx: AngebotErneutCtx): MailText {
  const { kunde, preise, publicUrl, meinBereichUrl } = ctx;
  const anmerkungBlock = ctx.anmerkung?.trim()
    ? `\n*Persönliche Anmerkung von Manuel:*\n${ctx.anmerkung.trim()}\n`
    : "";
  const memberBlock = meinBereichUrl
    ? `\n\nMein Bereich (alle Buchungen + Zahlungen + Rechnungen einsehen):\n${meinBereichUrl}`
    : "";

  return {
    subject: "Ihr Angebot von Eventverleih Bergstraße (erneut zugesendet)",
    body: `Hallo ${kunde.Vorname} ${kunde.Nachname},
${anmerkungBlock}
gerne senden wir Ihnen Ihr Angebot erneut zu:

*Preisübersicht:*
Mietsumme: ${preise.preisArtikel} EUR
Anzahlung bei Bestätigung (30 %): ${preise.anzahlung} EUR
Restzahlung bei Übergabe (70 %): ${preise.restzahlung} EUR
Kaution (nach Rückgabe vollständig erstattet): ${preise.kaution} EUR

Sie können das Angebot online ansehen und mit einem Klick bestätigen:
${publicUrl}

${UEBERGABE_HINWEIS}

Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${memberBlock}${SIGNATURE}`,
  };
}

export interface AngebotNachhakenCtx {
  kunde: KundeName;
  publicUrl: string;
  /** Event start date, ISO. null leaves the date out of the sentence. */
  eventDatumVon: string | null;
  meinBereichUrl: string | null;
}

/** Gentle follow-up a few days after the offer was sent. */
export function buildAngebotNachhaken(ctx: AngebotNachhakenCtx): MailText {
  const { kunde, publicUrl, eventDatumVon, meinBereichUrl } = ctx;
  const memberBlock = meinBereichUrl
    ? `\n\nMein Bereich (alle Buchungen + Zahlungen + Rechnungen einsehen):\n${meinBereichUrl}`
    : "";
  const datumStr = eventDatumVon ? ` am ${formatGermanShort(eventDatumVon)}` : "";

  return {
    subject: "Kurze Rückfrage zu Ihrem Angebot – Eventverleih Bergstraße",
    body: `Hallo ${kunde.Vorname} ${kunde.Nachname},

vor einigen Tagen habe ich Ihnen Ihr Angebot für Ihren Termin${datumStr} zugeschickt – ich wollte kurz nachfragen, ob alles passt oder ob noch Fragen offen sind.

Falls Sie es annehmen möchten: Sie können das Angebot online mit einem Klick bestätigen und direkt die Anzahlung (30 %) leisten. Erst damit sind die Artikel für Ihren Termin verbindlich reserviert – bis dahin kann sie leider auch jemand anderes anfragen.

Angebot ansehen und bestätigen:
${publicUrl}

Sollte sich Ihr Plan geändert haben, ist das natürlich auch in Ordnung – eine kurze Rückmeldung genügt, dann lege ich die Anfrage zu den Akten.

Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${memberBlock}${SIGNATURE}`,
  };
}

export interface AngebotAktualisiertCtx {
  kunde: KundeName;
  angebotsnummer: string;
  nextVersion: number;
  preisArtikel: number;
  publicUrl: string;
  anmerkung?: string | null;
}

/** A new version of an existing offer. */
export function buildAngebotAktualisiert(ctx: AngebotAktualisiertCtx): MailText {
  const { kunde, angebotsnummer, nextVersion, preisArtikel, publicUrl } = ctx;
  const anmerkungBlock = ctx.anmerkung?.trim() ? `\n*Anmerkung:*\n${ctx.anmerkung.trim()}\n` : "";
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");

  return {
    subject: `Aktualisiertes Angebot ${angebotsnummer} - Eventverleih Bergstraße`,
    body: `Hallo ${kunde.Vorname} ${kunde.Nachname},

Ihr Angebot wurde aktualisiert (Version ${nextVersion}).${anmerkungBlock}

Die aktuelle Mietsumme beträgt ${fmt(preisArtikel)} EUR.

Bitte schauen Sie sich die aktualisierten Details an und bestätigen Sie das Angebot erneut, wenn alles passt:
${publicUrl}

${UEBERGABE_HINWEIS}

Bei Fragen jederzeit per WhatsApp oder Anruf erreichbar: +49 156 79521124.${SIGNATURE}`,
  };
}
