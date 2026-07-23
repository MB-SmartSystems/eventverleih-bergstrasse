/**
 * Example contexts for the overview at /admin/vorlagen.
 *
 * These are not decoration. Several templates only show their interesting parts in
 * one branch — the deposit paragraph appears solely when the deposit is still open.
 * With a single fully paid example booking, exactly the sentences that need review
 * would stay invisible. So every template with a conditional block gets both cases.
 *
 * The values follow a real booking shape (75 EUR rental, 30 % deposit, 30 EUR
 * security) instead of invented round numbers, so the rendered text reads the way a
 * customer would actually receive it.
 */

const KUNDE = { Vorname: "Max", Nachname: "Mustermann" };
const NAME = "Max Mustermann";
const ORT = "Schlesierstraße 19a, 64665 Alsbach-Hähnlein";
const TERMIN = "Donnerstag, 23.07.2026 um 15:00 Uhr";
const ANGEBOT_URL = "https://eventverleih-bergstrasse.de/angebot/beispiel-token";
const VERTRAG_URL = "https://eventverleih-bergstrasse.de/vertrag/beispiel-token";
const MEIN_BEREICH = "https://eventverleih-bergstrasse.de/api/member/auto-login?token=beispiel";
const STRIPE_REST = "https://buy.stripe.com/beispiel-restzahlung";
const STRIPE_ANZAHLUNG = "https://buy.stripe.com/beispiel-anzahlung";
const STRIPE_KOMPLETT = "https://buy.stripe.com/beispiel-komplett";
const STRIPE_KAUTION = "https://checkout.stripe.com/c/pay/beispiel-kaution";

export const BEISPIEL_ANFRAGE_EINGANG = [
  {
    label: "Regelfall",
    ctx: {
      greeting: `Hallo ${NAME}`,
      zeitraum: "24.07.2026 bis 27.07.2026",
      summary: "  40x Stuhl\n  4x Biertisch-Garnitur",
      meinBereichUrl: MEIN_BEREICH,
    },
  },
  {
    label: "Ohne Kundenbereich-Link",
    ctx: {
      greeting: `Hallo ${NAME}`,
      zeitraum: "24.07.2026 bis 27.07.2026",
      summary: "  40x Stuhl",
      meinBereichUrl: "",
    },
  },
];

export const BEISPIEL_ANGEBOT = [
  {
    label: "Regelfall",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      preisArtikel: "75.00",
      anzahlung: "22.50",
      restzahlung: "52.50",
      kaution: "30.00",
      angebotUrl: ANGEBOT_URL,
      meinBereichUrl: MEIN_BEREICH,
    },
  },
  {
    label: "Mit persönlicher Anmerkung",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      preisArtikel: "75.00",
      anzahlung: "22.50",
      restzahlung: "52.50",
      kaution: "30.00",
      angebotUrl: ANGEBOT_URL,
      anmerkung: "Die Stühle stelle ich Ihnen schon gestapelt bereit.",
      meinBereichUrl: MEIN_BEREICH,
    },
  },
];

export const BEISPIEL_RUECKRUF = [{ label: "Regelfall", ctx: { vorname: KUNDE.Vorname, nachname: KUNDE.Nachname } }];

export const BEISPIEL_ABLEHNUNG = [
  {
    label: "Mit Grund (ausgebucht)",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      grund: "Die von Ihnen gewünschten Artikel sind für diesen Termin bereits vergeben.",
    },
  },
  {
    label: "Ohne Grund (interne Entscheidung)",
    ctx: { vorname: KUNDE.Vorname, nachname: KUNDE.Nachname, grund: "" },
  },
];

export const BEISPIEL_ANGEBOT_ERNEUT = [
  {
    label: "Regelfall",
    ctx: {
      kunde: KUNDE,
      preise: { preisArtikel: "75.00", anzahlung: "22.50", restzahlung: "52.50", kaution: "30.00" },
      publicUrl: ANGEBOT_URL,
      meinBereichUrl: MEIN_BEREICH,
    },
  },
];

export const BEISPIEL_ANGEBOT_NACHHAKEN = [
  {
    label: "Mit Eventdatum",
    ctx: { kunde: KUNDE, publicUrl: ANGEBOT_URL, eventDatumVon: "2026-07-24", meinBereichUrl: MEIN_BEREICH },
  },
  {
    label: "Ohne Eventdatum",
    ctx: { kunde: KUNDE, publicUrl: ANGEBOT_URL, eventDatumVon: null, meinBereichUrl: null },
  },
];

export const BEISPIEL_ANGEBOT_AKTUALISIERT = [
  {
    label: "Regelfall",
    ctx: {
      kunde: KUNDE,
      angebotsnummer: "AN-2026-027",
      nextVersion: 2,
      preisArtikel: 75,
      publicUrl: ANGEBOT_URL,
    },
  },
];

export const BEISPIEL_VERTRAG = [
  {
    label: "Regelfall, Zahlungslink vorhanden",
    ctx: {
      kundeName: NAME,
      stripeLink: STRIPE_ANZAHLUNG,
      komplettLink: STRIPE_KOMPLETT,
      angebotsnummer: "AN-2026-027",
      vertragsUrl: VERTRAG_URL,
      meinBereichUrl: MEIN_BEREICH,
      aufbauAbsatz: "",
    },
  },
  {
    label: "Ohne Zahlungslink (Stripe nicht erreichbar)",
    ctx: {
      kundeName: NAME,
      stripeLink: null,
      komplettLink: null,
      angebotsnummer: "AN-2026-027",
      vertragsUrl: VERTRAG_URL,
      meinBereichUrl: "",
      aufbauAbsatz: "",
    },
  },
];

export const BEISPIEL_ZAHLUNG = [{ label: "Regelfall", ctx: { kname: NAME } }];

export const BEISPIEL_ANZAHLUNG_ERINNERUNG = (tpl: string) => [
  {
    label: "Mit Zahlungslink",
    ctx: {
      tpl,
      kundeName: NAME,
      anzahlungSoll: 22.5,
      eventDatumVon: "2026-07-24",
      stripeLink: STRIPE_ANZAHLUNG,
      meinBereichUrl: MEIN_BEREICH,
    },
  },
  {
    label: "Ohne Zahlungslink",
    ctx: {
      tpl,
      kundeName: NAME,
      anzahlungSoll: 22.5,
      eventDatumVon: "2026-07-24",
      stripeLink: null,
      meinBereichUrl: null,
    },
  },
];

export const BEISPIEL_RESTZAHLUNG_INFO = [
  {
    label: "Mit Zahlungslink",
    ctx: {
      kundeName: NAME,
      restSoll: 52.5,
      eventDatumVon: "2026-07-24",
      stripeLink: STRIPE_REST,
      meinBereichUrl: MEIN_BEREICH,
    },
  },
  {
    label: "Ohne Zahlungslink",
    ctx: {
      kundeName: NAME,
      restSoll: 52.5,
      eventDatumVon: "2026-07-24",
      stripeLink: null,
      meinBereichUrl: null,
    },
  },
];

export const BEISPIEL_KAUTION_HOLD = [
  {
    label: "Regelfall",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      amount: 30,
      kautionUrl: STRIPE_KAUTION,
      meinBereichUrl: MEIN_BEREICH,
    },
  },
];

export const BEISPIEL_KAUTION_BAR = [
  { label: "Fünf Tage vor dem Event", ctx: { kundeName: NAME, kautionSoll: 30, tageBis: 5 } },
  { label: "Am Vortag oder Eventtag", ctx: { kundeName: NAME, kautionSoll: 30, tageBis: 1 } },
];

export const BEISPIEL_TERMIN_ERINNERUNG = [
  {
    label: "Restzahlung und Kaution offen",
    ctx: {
      kundeName: NAME,
      terminText: TERMIN,
      ort: ORT,
      restSoll: 52.5,
      restBezahltAm: null,
      restLink: STRIPE_REST,
      kautionSoll: 30,
      kautionHinterlegtAm: null,
    },
  },
  {
    label: "Alles bezahlt, reine Terminmail",
    ctx: {
      kundeName: NAME,
      terminText: TERMIN,
      ort: ORT,
      restSoll: 52.5,
      restBezahltAm: "2026-07-20",
      restLink: null,
      kautionSoll: 30,
      kautionHinterlegtAm: "2026-07-20",
    },
  },
  {
    label: "Nur Kaution offen",
    ctx: {
      kundeName: NAME,
      terminText: TERMIN,
      ort: ORT,
      restSoll: 52.5,
      restBezahltAm: "2026-07-20",
      restLink: null,
      kautionSoll: 30,
      kautionHinterlegtAm: null,
    },
  },
  {
    label: "Lieferung durch Manuel (alles bezahlt)",
    ctx: {
      kundeName: NAME,
      terminText: TERMIN,
      ort: ORT,
      restSoll: 52.5,
      restBezahltAm: "2026-07-20",
      restLink: null,
      kautionSoll: 30,
      kautionHinterlegtAm: "2026-07-20",
      manuelLiefert: true,
    },
  },
];

export const BEISPIEL_RUECKGABE_ERINNERUNG = [
  { label: "Selbstrückgabe zum Treffpunkt", ctx: { kundeName: NAME, terminText: "Montag, 27.07.2026 um 10:00 Uhr", ort: ORT, manuelHoltAb: false } },
  { label: "Abholung durch Manuel", ctx: { kundeName: NAME, terminText: "Montag, 27.07.2026 um 10:00 Uhr", ort: ORT, manuelHoltAb: true } },
];

export const BEISPIEL_TERMIN_1H = (label: string) => [
  {
    label: "Nichts offen",
    ctx: { kundeName: NAME, label, zeit: "15:00 Uhr", ort: ORT, zahlungsHinweis: "" },
  },
  {
    label: "Restzahlung und Kaution offen",
    ctx: {
      kundeName: NAME,
      label,
      zeit: "15:00 Uhr",
      ort: ORT,
      zahlungsHinweis:
        "\nKurzer Hinweis: Offen ist noch Restzahlung 52,50 EUR und Kaution 30,00 EUR. Am schnellsten erledigen Sie das vorab online.\n" +
        `\nHier direkt erledigen:\n${STRIPE_REST}\n${STRIPE_KAUTION}\n`,
    },
  },
];

export const BEISPIEL_GOOGLE_REVIEW = [
  { label: "Mit Bewertungslink", ctx: { kundeName: NAME, reviewUrl: "https://g.page/r/beispiel/review" } },
  { label: "Ohne Bewertungslink", ctx: { kundeName: NAME, reviewUrl: "" } },
];

export const BEISPIEL_STORNO = [
  {
    label: "Erstattung fällig",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      buchungId: 32,
      stornogebuehrProzent: 0,
      staffelLabel: "mehr als 14 Tage vor Event",
      mietsumme: 75,
      stornogebuehrEur: 0,
      bezahlt: 22.5,
      erstattungEur: 22.5,
      nachzahlungEur: 0,
    },
  },
  {
    label: "Nachzahlung fällig",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      buchungId: 32,
      stornogebuehrProzent: 50,
      staffelLabel: "7 bis 13 Tage vor Event",
      mietsumme: 75,
      stornogebuehrEur: 37.5,
      bezahlt: 22.5,
      erstattungEur: 0,
      nachzahlungEur: 15,
    },
  },
  {
    label: "Kostenfrei, nichts zu erstatten",
    ctx: {
      vorname: KUNDE.Vorname,
      nachname: KUNDE.Nachname,
      buchungId: 32,
      stornogebuehrProzent: 0,
      staffelLabel: "mehr als 14 Tage vor Event",
      mietsumme: 75,
      stornogebuehrEur: 0,
      bezahlt: 0,
      erstattungEur: 0,
      nachzahlungEur: 0,
    },
  },
];

export const BEISPIEL_STORNO_UEBERZAHLUNG = {
  label: "Mit zu viel gezahltem Betrag",
  ctx: {
    vorname: KUNDE.Vorname,
    nachname: KUNDE.Nachname,
    buchungId: 32,
    stornogebuehrProzent: 50,
    staffelLabel: "7 Tage vor dem Event: 50 %",
    mietsumme: 75,
    stornogebuehrEur: 37.5,
    bezahlt: 75,
    erstattungEur: 37.5,
    nachzahlungEur: 0,
    ueberzahlungEur: 17.5,
  },
};

/** 100 % Gebuehr: die Erstattung besteht ausschliesslich aus zu viel gezahltem Geld. */
export const BEISPIEL_STORNO_NUR_UEBERZAHLUNG = {
  label: "Volle Gebühr, nur Überzahlung zurück",
  ctx: {
    vorname: KUNDE.Vorname,
    nachname: KUNDE.Nachname,
    buchungId: 32,
    stornogebuehrProzent: 100,
    staffelLabel: "Weniger als 4 Tage vor Event: 100 % Stornogebühr",
    mietsumme: 75,
    stornogebuehrEur: 75,
    bezahlt: 75,
    erstattungEur: 0,
    nachzahlungEur: 0,
    ueberzahlungEur: 17.5,
  },
};

/** Bar bezahlt: es gibt nichts zurueckzubuchen, die Mail fragt nach der Bankverbindung. */
export const BEISPIEL_STORNO_BAR = {
  label: "Bar bezahlt, Bankverbindung nötig",
  ctx: {
    vorname: KUNDE.Vorname,
    nachname: KUNDE.Nachname,
    buchungId: 32,
    stornogebuehrProzent: 50,
    staffelLabel: "7-14 Tage vor Event: 50 % Stornogebühr",
    mietsumme: 75,
    stornogebuehrEur: 37.5,
    bezahlt: 75,
    erstattungEur: 37.5,
    nachzahlungEur: 0,
    erstattungsweg: "bank" as const,
  },
};

export const BEISPIEL_LOGIN_LINK = [
  {
    label: "Regelfall",
    ctx: { magicLink: "https://eventverleih-bergstrasse.de/mein-bereich/login?token=beispiel" },
  },
];

const RUECKGABE_ZEILE = "\n\nRückgabe-Termin: Montag, 27.07.2026 um 14:30 Uhr (Grillhütte Sandwiese, Alsbach-Hähnlein).";

export const BEISPIEL_UEBERGABE_ERFOLGT = [
  {
    label: "Alles vorab bezahlt",
    ctx: {
      kundeName: NAME,
      artikelZeilen: ["- 30× Stuhl", "- 4× Biertisch-Garnitur"],
      rueckgabeZeile: RUECKGABE_ZEILE,
      kautionSollEur: 30,
      kautionHinterlegt: true,
      offenRestzahlungEur: 0,
      offenKautionEur: 0,
    },
  },
  {
    label: "Bei der Übergabe kassiert, mit Überzahlung",
    ctx: {
      kundeName: NAME,
      artikelZeilen: ["- 30× Stuhl"],
      rueckgabeZeile: RUECKGABE_ZEILE,
      kautionSollEur: 30,
      kautionHinterlegt: true,
      kassiert: { gesamtEur: 100, restzahlungEur: 52.5, kautionEur: 30, ueberzahlungEur: 17.5 },
      offenRestzahlungEur: 0,
      offenKautionEur: 0,
    },
  },
  {
    label: "Danach noch offen",
    ctx: {
      kundeName: NAME,
      artikelZeilen: ["- 30× Stuhl"],
      rueckgabeZeile: RUECKGABE_ZEILE,
      kautionSollEur: 30,
      kautionHinterlegt: false,
      offenRestzahlungEur: 52.5,
      offenKautionEur: 30,
      restLink: STRIPE_REST,
      kautionLink: STRIPE_KAUTION,
    },
  },
];

export const BEISPIEL_KAUTION_IBAN = [
  {
    label: "Kaution und Überzahlung",
    ctx: { kundeName: NAME, kautionEur: 30, ueberzahlungEur: 17.5 },
  },
  {
    label: "Nur Kaution",
    ctx: { kundeName: NAME, kautionEur: 30, ueberzahlungEur: 0 },
  },
];
