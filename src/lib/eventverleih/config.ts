/**
 * Eventverleih-System-Konstanten.
 *
 * Hier zentralisiert, damit Wording-Aenderungen einmal passieren.
 * Spaeter (Plan Phase 5 Etappe B) wandert das in Baserow T953 (System_Konfiguration)
 * fuer pro-Buchung-Override.
 */

export const TREFFPUNKT_STANDARD = "Grillhuette Sandwiese (Freizeitanlage), Alsbach-Haehnlein";
export const TREFFPUNKT_MAPS_URL = "https://maps.google.com/?q=Grillhuette+Sandwiese+Alsbach-Haehnlein";
export const TREFFPUNKT_HINWEIS = "Der Treffpunkt liegt zentral und ist gut erreichbar. Den genauen Termin sprechen wir telefonisch ab.";

export const KONTAKT_TEL = "+49 156 79521124";
export const KONTAKT_MAIL = "info@eventverleih-bergstrasse.de";

// Mietzeitraum-Constraints
export const MAX_RANGE_DAYS = 5;

// Verfuegbarkeits-Schwelle fuer „nur noch X verfuegbar"-Anzeige
export const KNAPP_THRESHOLD_FRACTION = 0.5; // restzahl <= bestand_gesamt * 0.5 → knapp

// Stornogebuehren-Staffel (Tage vor Event → % der Mietsumme)
export const STORNO_STAFFEL = [
  { tageBis: 14, prozent: 0 },   // > 14 Tage = kostenfrei
  { tageBis: 7, prozent: 50 },   // 7-14 Tage
  { tageBis: 4, prozent: 75 },   // 4-7 Tage
  { tageBis: 0, prozent: 100 },  // < 4 Tage
];

// Restzahlungs-Erinnerung-Trigger (Tage vor Event)
export const RESTZAHLUNG_ERINNERUNG_TAGE = [14, 7, 3];

// Kaution-Pruefphase (Werktage nach Rueckgabe)
export const KAUTION_PRUEFFRIST_WERKTAGE = 2;
