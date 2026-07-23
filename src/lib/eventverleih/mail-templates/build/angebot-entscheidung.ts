import type { MailText } from "../types";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";

/**
 * The three customer mails behind an inquiry decision: offer, callback request,
 * rejection. All pure — the route decides which one to send.
 */

// Vorformulierte, höfliche KUNDEN-Texte je Ablehnungsgrund (NICHT die interne Notiz).
export const ABLEHNEN_TEXTE: Record<string, string> = {
  ausgebucht: "Leider sind die von Ihnen gewünschten Artikel für diesen Termin bereits vergeben.",
  liefergebiet: "Leider liegt Ihr Veranstaltungsort außerhalb unseres Liefergebiets.",
  nicht_verfuegbar: "Leider können wir die gewünschten Artikel aktuell nicht anbieten.",
  kurzfristig: "Leider ist der Termin für eine zuverlässige Bereitstellung zu kurzfristig.",
};

/** KUNDEN-Text für die Absage. 'intern' (z.B. „möchte nicht vermieten") = neutral-höflich, KEIN Grund genannt. */
export function resolveAblehnenText(kategorie?: string, kundenText?: string): string {
  if (kategorie === "sonstiges") return (kundenText || "").trim();
  if (kategorie === "intern" || !kategorie) return "";
  return ABLEHNEN_TEXTE[kategorie] || "";
}

const SIGNATURE = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

export function buildAngebotsMail(opts: {
  vorname: string;
  nachname: string;
  preisArtikel: string;
  anzahlung: string;
  restzahlung: string;
  kaution: string;
  angebotUrl: string;
  anmerkung?: string;
  meinBereichUrl?: string;
}): MailText {
  const greeting = `Hallo ${opts.vorname} ${opts.nachname}`;
  const anmerkungBlock = opts.anmerkung
    ? `\n*Persönliche Anmerkung von Manuel:*\n${opts.anmerkung}\n`
    : "";
  const memberBlock = opts.meinBereichUrl
    ? `\n\nMein Bereich (alle Buchungen + Zahlungen + Rechnungen einsehen):\n${opts.meinBereichUrl}`
    : "";
  return {
    subject: "Ihr Angebot von Eventverleih Bergstraße",
    body: `${greeting},
${anmerkungBlock}
vielen Dank für Ihre Anfrage. Hier ist Ihr Angebot:

*Preisübersicht:*
Mietsumme: ${opts.preisArtikel} EUR
Anzahlung bei Bestätigung (30 %): ${opts.anzahlung} EUR
Restzahlung bei Übergabe (70 %): ${opts.restzahlung} EUR
Kaution (nach Rückgabe vollständig erstattet): ${opts.kaution} EUR

Sie können das Angebot online ansehen und mit einem Klick bestätigen:
${opts.angebotUrl}

${UEBERGABE_HINWEIS}

Lassen Sie sich mit der Entscheidung gern Zeit. Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${memberBlock}${SIGNATURE}`,
  };
}

export function buildRueckrufMail(opts: { vorname: string; nachname: string }): MailText {
  return {
    subject: "Ihre Anfrage bei Eventverleih Bergstraße - kurze Rückfrage",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank für Ihre Anfrage. Damit ich Ihnen ein passendes Angebot machen kann, möchte ich gerne kurz mit Ihnen sprechen - meist sind 3-5 Minuten ausreichend, um alle Details zu klären.

Können wir kurz telefonieren? Sie erreichen mich werktags am besten unter +49 156 79521124 (auch WhatsApp).

Alternativ rufe ich Sie zurück - lassen Sie mich einfach wissen, wann es Ihnen passt.${SIGNATURE}`,
  };
}

export function buildAblehnenMail(opts: { vorname: string; nachname: string; grund?: string }): MailText {
  const grundBlock = opts.grund && opts.grund.trim() ? `\n\n${opts.grund.trim()}` : "";
  return {
    subject: "Ihre Anfrage bei Eventverleih Bergstraße",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank für Ihre Anfrage. Leider kann ich Ihnen kein Angebot für diesen Termin machen.${grundBlock}

Falls Sie noch andere Termine in Erwägung ziehen oder Fragen haben, melden Sie sich gerne - vielleicht finden wir doch eine Lösung. Sie erreichen mich werktags am besten unter +49 156 79521124 (auch WhatsApp).

Ich wünsche Ihnen viel Erfolg bei Ihrer Feier und stehe für zukünftige Anfragen jederzeit zur Verfügung.${SIGNATURE}`,
  };
}
