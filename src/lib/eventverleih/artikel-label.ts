/**
 * Ein- und Mehrzahl von Artikel-Bezeichnungen.
 *
 * Bis zum 23.07.2026 stand ueberall "30× Stuhl" — in der Uebergabe-Mail, im Angebot,
 * im Vertrag, auf dem Beleg. Die Artikel-Tabelle (957) kannte nur eine Schreibweise.
 * Seitdem gibt es dort das Feld `Mehrzahl`; ist es leer, bleibt es bei der bisherigen
 * Bezeichnung. Die Anzeige darf nie darauf warten, dass ein Feld gefuellt ist.
 *
 * Reine Funktionen: keine Baserow-Zugriffe, kein Datum, kein Zufall.
 */

/** Die beiden Namensformen einer Artikel-Zeile, so wie sie in Baserow stehen. */
export interface ArtikelName {
  Bezeichnung: string;
  Mehrzahl?: string | null;
}

/**
 * Die passende Namensform. Ab zwei Stueck die Mehrzahl, sofern gepflegt.
 *
 * Bruchzahlen (0,5 Tage) gibt es bei Artikeln nicht; entschieden wird schlicht an
 * `anzahl > 1`, damit "1× Stuhl" die Einzahl behaelt.
 */
export function artikelName(anzahl: number, a: ArtikelName | null | undefined, fallback: string): string {
  if (!a) return fallback;
  const mehrzahl = (a.Mehrzahl ?? "").trim();
  return anzahl > 1 && mehrzahl ? mehrzahl : a.Bezeichnung;
}

/** Fertige Zeile "30× Stühle". */
export function artikelLabel(anzahl: number, a: ArtikelName | null | undefined, fallback: string): string {
  return `${anzahl}× ${artikelName(anzahl, a, fallback)}`;
}

/** Nachschlagewerk id → Namensformen, aus einer geladenen Artikel-Liste. */
export function artikelNamenById<T extends ArtikelName & { id: number }>(
  rows: T[],
): Map<number, ArtikelName> {
  const m = new Map<number, ArtikelName>();
  for (let i = 0; i < rows.length; i++) {
    m.set(rows[i].id, { Bezeichnung: rows[i].Bezeichnung, Mehrzahl: rows[i].Mehrzahl ?? null });
  }
  return m;
}
