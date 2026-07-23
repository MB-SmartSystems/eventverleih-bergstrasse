import type { MailText } from "../types";
import { eurMail } from "@/lib/eventverleih/zahlung";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";

/** Confirmation that an inquiry arrived. Goes out automatically. */
export interface AnfrageEingangCtx {
  /** Already built greeting line without the comma, e.g. "Hallo Max Mustermann". */
  greeting: string;
  /** Requested rental period, already formatted. */
  zeitraum: string;
  /** What the customer asked for, already formatted as a list. */
  summary: string;
  meinBereichUrl: string;
}

export function buildAnfrageEingang(ctx: AnfrageEingangCtx): MailText {
  const { greeting, zeitraum, summary, meinBereichUrl } = ctx;
  return {
    subject: `Eingangsbestätigung - Ihre Anfrage bei Eventverleih Bergstraße`,
    body: `${greeting},

vielen Dank für Ihre Anfrage bei Eventverleih Bergstraße. Ich habe Ihre Nachricht erhalten und melde mich in der Regel innerhalb von 24 Stunden mit einem konkreten Angebot und der Verfügbarkeitsbestätigung zurück.

Gewünschter Mietzeitraum:
  ${zeitraum}

Was Sie angefragt haben:
${summary}

Hinweis: Wir vermieten standardmäßig zur Selbstabholung an unserem Treffpunkt (Grillhütte Sandwiese / Freizeitanlage in Alsbach-Hähnlein). Den genauen Übergabe-Termin sprechen wir telefonisch ab. Falls Sie Lieferung oder Aufbau brauchen, gehen wir im Angebot konkret darauf ein.${meinBereichUrl ? `

Mein Bereich (Buchung jederzeit einsehen, Status nachverfolgen, später Rechnung herunterladen):
${meinBereichUrl}` : ""}

Falls Sie noch Fragen haben oder etwas ergänzen möchten, antworten Sie einfach direkt auf diese Mail oder rufen Sie an unter +49 156 79521124 (auch WhatsApp).

Bis gleich,

Mit freundlichen Grüßen
Manuel Büttner

Eventverleih Bergstraße
Schlesierstraße 19a, 64665 Alsbach-Hähnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de
Web: eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`,
  };
}

export interface VertragBestaetigungCtx {
  /** Customer name; empty falls back to a nameless greeting. */
  kundeName: string;
  stripeLink: string | null;
  komplettLink: string | null;
  angebotsnummer: string;
  vertragsUrl: string;
  meinBereichUrl: string;
  /** Extra paragraph when a folding tent with assembly was booked. */
  aufbauAbsatz: string;
}

/** Booking acknowledged, deposit requested. */
export function buildVertragBestaetigung(ctx: VertragBestaetigungCtx): MailText {
  const { kundeName, stripeLink, komplettLink, angebotsnummer, vertragsUrl, meinBereichUrl, aufbauAbsatz } = ctx;

  const komplettZeile = komplettLink
    ? `

Oder direkt komplett zahlen (dann ist alles erledigt):
   ${komplettLink}`
    : "";
  const stripeBlock = stripeLink
    ? `Am bequemsten zahlen Sie online per Karte / Klarna / Sofort:
   ${stripeLink}${komplettZeile}`
    : `Ihren persönlichen Zahlungslink sende ich Ihnen umgehend zu — melden Sie sich gern kurz, falls er nicht ankommt.`;

  const anrede = kundeName ? `Hallo ${kundeName},` : "Hallo,";

  return {
    subject: "Termin vorgemerkt - bitte Anzahlung leisten | Eventverleih Bergstraße",
    body: `${anrede}

vielen Dank für Ihre Bestätigung. Ihr Termin ist zunächst vorgemerkt.

WICHTIG: Mit Eingang Ihrer Anzahlung von 30 Prozent wird Ihre Reservierung verbindlich bestätigt. Bitte leisten Sie die Anzahlung innerhalb von 7 Tagen:
${stripeBlock}
Verwendungszweck: ${angebotsnummer}

Restzahlung und Kaution folgen vor bzw. bei der Übergabe — bequem online per Zahlungslink.

Etwa 7 Tage vor dem Event melde ich mich für die finale Abstimmung von Übergabe-Ort und -Zeit. ${UEBERGABE_HINWEIS}${aufbauAbsatz}

Ihren vollständigen Mietvertrag mit allen Bedingungen finden Sie hier:
${vertragsUrl}${meinBereichUrl ? `

Mein Bereich (Buchungs-Status + Zahlungen + Rechnungen):
${meinBereichUrl}` : ""}

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

export interface StornoBestaetigungCtx {
  vorname: string;
  nachname: string;
  buchungId: number;
  stornogebuehrProzent: number;
  staffelLabel: string;
  mietsumme: number;
  stornogebuehrEur: number;
  bezahlt: number;
  erstattungEur: number;
  nachzahlungEur: number;
}

/** Cancellation confirmed, with the fee breakdown from the AGB. */
export function buildStornoBestaetigung(ctx: StornoBestaetigungCtx): MailText {
  const { vorname, nachname, buchungId, staffelLabel, mietsumme, bezahlt } = ctx;
  const calc = {
    erstattung_eur: ctx.erstattungEur,
    nachzahlung_eur: ctx.nachzahlungEur,
    stornogebuehr_prozent: ctx.stornogebuehrProzent,
    stornogebuehr_eur: ctx.stornogebuehrEur,
    staffel_label: staffelLabel,
  };

  const erstattungText = calc.erstattung_eur > 0
    ? `Sie erhalten ${eurMail(calc.erstattung_eur)} EUR zurück — die Erstattung erfolgt über Stripe auf Ihr ursprüngliches Zahlungsmittel (in der Regel 5–10 Werktage).`
    : calc.nachzahlung_eur > 0
      ? `Die Stornogebühr ist höher als Ihre Anzahlung. Wir stellen Ihnen die Differenz von ${eurMail(calc.nachzahlung_eur)} EUR in Rechnung und melden uns mit dem Zahlungslink.`
      : `Es ist keine Erstattung fällig (kostenfreie Stornierung).`;

  return {
    subject: `Stornierung Ihrer Buchung #${buchungId} — Eventverleih Bergstraße`,
    body: `Hallo ${vorname} ${nachname},

Ihre Stornierung der Buchung #${buchungId} ist eingegangen.

Stornogebühr (laut AGB): ${calc.stornogebuehr_prozent} % der Mietsumme
  ${calc.staffel_label}
  Mietsumme: ${eurMail(mietsumme)} EUR
  Stornogebühr: ${eurMail(calc.stornogebuehr_eur)} EUR
  Bereits bezahlt: ${eurMail(bezahlt)} EUR

${erstattungText}

Bei Rückfragen melden Sie sich gerne per WhatsApp/Tel +49 156 79521124.

Mit freundlichen Grüßen
Manuel Büttner — Eventverleih Bergstraße`,
  };
}

export interface LoginMagicLinkCtx {
  magicLink: string;
}

/** One-click login for the customer area. Deliberately nameless — the address is the identity. */
export function buildLoginMagicLink(ctx: LoginMagicLinkCtx): MailText {
  const { magicLink } = ctx;
  return {
    subject: "Ihr Login-Link für Mein Bereich — Eventverleih Bergstraße",
    body: `Hallo,

hier ist Ihr Login-Link für Mein Bereich bei Eventverleih Bergstraße:

${magicLink}

Der Link ist 30 Tage gültig. Wenn Sie diesen Login nicht angefordert haben, ignorieren Sie diese Mail einfach.

Bei Fragen: WhatsApp +49 156 79521124 oder direkt antworten.

Mit freundlichen Grüßen
Manuel Büttner — Eventverleih Bergstraße`,
  };
}
