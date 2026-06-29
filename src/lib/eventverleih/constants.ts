/** Maximale Mietdauer in Tagen (inkl. Tag-Differenz: 22.-25. = 4 Tage). */
export const MAX_RANGE_DAYS = 5;

export function rangeDays(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000,
  );
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatGerman(iso: string): string {
  const d = isoToDate(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatGermanShort(iso: string): string {
  const d = isoToDate(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Kaution auf die nächste volle €5 aufrunden — bequemer für Barzahlung bei Übergabe
 * (z.B. 33,60 € → 35 €, 41 € → 45 €). Immer auf, nie ab; die Kaution ist erstattbar.
 * Epsilon gegen Float-Artefakte (35.0000001 soll 35 bleiben, nicht 40).
 */
export function rundeKaution(eur: number): number {
  return Math.ceil((eur - 1e-9) / 5) * 5;
}

/**
 * Standard-Hinweis für Kundenmails (Angebot + Bestätigungen): Übergabe nur nach
 * Terminvereinbarung am Treffpunkt — Kunden sollen NICHT spontan an der
 * Geschäftsanschrift (= Privatadresse aus dem Impressum) auftauchen.
 */
export const UEBERGABE_HINWEIS =
  "Übergabe und Rückgabe erfolgen ausschließlich nach Terminvereinbarung — an unserem Treffpunkt (Grillhütte Sandwiese, Alsbach-Hähnlein) oder per vereinbarter Lieferung. Eine Abholung an unserer Geschäftsanschrift ist nicht möglich.";
