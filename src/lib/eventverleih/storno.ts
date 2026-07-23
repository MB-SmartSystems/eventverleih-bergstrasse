/**
 * Storno-Logik laut AGB (4-Stufen-Staffel auf Mietsumme).
 *
 * Stornogebuehr-Staffel (Plan ich-hab-mal-bitte-snappy-boole):
 *   > 14 Tage vor Event: 0 % Mietsumme (kostenfrei)
 *   7-14 Tage:           50 % Mietsumme
 *   4-7 Tage:            75 % Mietsumme
 *   < 4 Tage:            100 % Mietsumme
 *
 * Erstattung = bereits_bezahlt - Stornogebuehr.
 * Bei negativer Erstattung muss der Kunde nachzahlen.
 *
 * Mietsumme = Preis_Artikel + Preis_Lieferung + Preis_Abholung + Preis_Aufbau (OHNE Kaution).
 * Kaution wird separat behandelt (bei Storno vor Uebergabe = nie eingezogen, voll zurueck).
 */

export interface StornoCalc {
  tage_bis_event: number;
  stornogebuehr_prozent: number; // 0 / 50 / 75 / 100
  stornogebuehr_eur: number;
  bereits_bezahlt_eur: number;
  erstattung_eur: number; // > 0 = Kunde kriegt zurück; < 0 = Kunde muss nachzahlen
  nachzahlung_eur: number; // wenn erstattung < 0: -erstattung; sonst 0
  staffel_label: string;
}

export function berechneStorno(args: {
  eventDatumVon: string | null;
  mietsummeEur: number;
  bereitsBezahltEur: number;
}): StornoCalc {
  const { eventDatumVon, mietsummeEur, bereitsBezahltEur } = args;
  if (!eventDatumVon) {
    return {
      tage_bis_event: -1,
      stornogebuehr_prozent: 0,
      stornogebuehr_eur: 0,
      bereits_bezahlt_eur: bereitsBezahltEur,
      erstattung_eur: bereitsBezahltEur,
      nachzahlung_eur: 0,
      staffel_label: "Kein Event-Datum",
    };
  }
  const eventDate = new Date(eventDatumVon);
  const tage = Math.floor((eventDate.getTime() - Date.now()) / 86_400_000);

  let prozent = 0;
  let label = "";
  if (tage > 14) {
    prozent = 0;
    label = "Mehr als 14 Tage vor Event — kostenfreie Stornierung";
  } else if (tage >= 7) {
    prozent = 50;
    label = "7-14 Tage vor Event — 50 % Stornogebühr";
  } else if (tage >= 4) {
    prozent = 75;
    label = "4-7 Tage vor Event — 75 % Stornogebühr";
  } else {
    prozent = 100;
    label = "Weniger als 4 Tage vor Event — 100 % Stornogebühr";
  }

  const stornogebuehr = Math.round(mietsummeEur * (prozent / 100) * 100) / 100;
  const erstattung = Math.round((bereitsBezahltEur - stornogebuehr) * 100) / 100;
  const nachzahlung = erstattung < 0 ? -erstattung : 0;

  return {
    tage_bis_event: tage,
    stornogebuehr_prozent: prozent,
    stornogebuehr_eur: stornogebuehr,
    bereits_bezahlt_eur: bereitsBezahltEur,
    erstattung_eur: erstattung,
    nachzahlung_eur: nachzahlung,
    staffel_label: label,
  };
}
