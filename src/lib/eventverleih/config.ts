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

// Anzeige-Label mit Umlauten fuer Kunden-Mails (TREFFPUNKT_STANDARD ist ASCII fuer Systemzwecke).
export const TREFFPUNKT_LABEL = "Grillhütte Sandwiese (Freizeitanlage), Alsbach-Hähnlein";

/**
 * Übergabe-/Rückgabe-Ort.
 *  - Explizite Uebergabe_Adresse gewinnt immer (manuelle Override).
 *  - Übergabe_Typ "Beim_Kunden" / "Lieferung" → Lieferadresse des Kunden.
 *  - Übergabe_Typ "Standard" → Treffpunkt Grillhütte.
 *  - Übergabe_Typ leer/null → Fallback Preis-Logik (Backward-Compat für alte Buchungen):
 *      Preis_Lieferung > 0 (Übergabe) / Preis_Abholung > 0 (Rückgabe) → Lieferadresse.
 */
export function uebergabeOrt(
  b: {
    Uebergabe_Adresse?: string | null;
    Lieferadresse?: string | null;
    Preis_Lieferung?: string | number | null;
    Preis_Abholung?: string | number | null;
    Übergabe_Typ?: { value: string } | string | null;
  },
  which: "uebergabe" | "rueckgabe",
): string {
  const override = (b.Uebergabe_Adresse ?? "").trim();
  if (override) return override;

  const typVal =
    typeof b.Übergabe_Typ === "object" && b.Übergabe_Typ !== null
      ? (b.Übergabe_Typ as { value: string }).value
      : ((b.Übergabe_Typ as string | null | undefined) ?? "");
  if (typVal === "Beim_Kunden" || typVal === "Lieferung") {
    const liefer = (b.Lieferadresse ?? "").trim();
    return liefer || TREFFPUNKT_LABEL;
  }
  if (typVal === "Standard") return TREFFPUNKT_LABEL;

  // Fallback: Preis-basierte Logik für Buchungen ohne Übergabe_Typ
  const num = (v: string | number | null | undefined): number =>
    typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
  const manuelFaehrt = which === "uebergabe" ? num(b.Preis_Lieferung) > 0 : num(b.Preis_Abholung) > 0;
  const liefer = (b.Lieferadresse ?? "").trim();
  if (manuelFaehrt && liefer) return liefer;
  return TREFFPUNKT_LABEL;
}

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
