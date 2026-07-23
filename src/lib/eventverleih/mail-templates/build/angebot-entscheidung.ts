import type { MailText } from "../types";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";
import { SIGNATURE } from "./bausteine";

/**
 * The three customer mails behind an inquiry decision: offer, callback request,
 * rejection. All pure — the route decides which one to send.
 */

// Vorformulierte, höfliche KUNDEN-Texte je Ablehnungsgrund (NICHT die interne Notiz).
// Kein „Leider" am Satzanfang: das steht bereits im Basissatz der Absage-Mail (kein doppeltes „leider", B1).
export const ABLEHNEN_TEXTE: Record<string, string> = {
  ausgebucht: "Die von Ihnen gewünschten Artikel sind für diesen Termin bereits vergeben.",
  liefergebiet: "Ihr Veranstaltungsort liegt außerhalb unseres Liefergebiets.",
  nicht_verfuegbar: "Die gewünschten Artikel können wir aktuell nicht anbieten.",
  kurzfristig: "Der Termin ist für eine zuverlässige Bereitstellung zu kurzfristig.",
};

/** KUNDEN-Text für die Absage. 'intern' (z.B. „möchte nicht vermieten") = neutral-höflich, KEIN Grund genannt. */
export function resolveAblehnenText(kategorie?: string, kundenText?: string): string {
  if (kategorie === "sonstiges") return (kundenText || "").trim();
  if (kategorie === "intern" || !kategorie) return "";
  return ABLEHNEN_TEXTE[kategorie] || "";
}


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
    subject: "Ihre Anfrage bei Eventverleih Bergstraße, kurze Rückfrage",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank für Ihre Anfrage. Damit ich Ihnen ein passendes Angebot machen kann, habe ich noch ein paar kurze Rückfragen, die sich am schnellsten telefonisch klären lassen (meist 3 bis 5 Minuten).

Ich melde mich in den nächsten Tagen telefonisch bei Ihnen. Falls Ihnen eine bestimmte Zeit besser passt oder Sie mich vorab erreichen möchten, schreiben Sie mir gern oder rufen Sie an: +49 156 79521124 (auch WhatsApp).${SIGNATURE}`,
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
