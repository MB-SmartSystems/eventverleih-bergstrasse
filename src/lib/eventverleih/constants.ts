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
 * Kaution auf den nächsten vollen 1 € aufrunden (Manuel 2026-07-06; vorher 5 €).
 * Immer auf, nie ab; die Kaution ist erstattbar. Epsilon gegen Float-Artefakte
 * (27.0000001 soll 27 bleiben, nicht 28).
 */
export function rundeKaution(eur: number): number {
  return Math.ceil(eur - 1e-9);
}

/**
 * Standard-Hinweis für Kundenmails (Angebot + Bestätigungen): Übergabe nur nach
 * Terminvereinbarung am Treffpunkt — Kunden sollen NICHT spontan an der
 * Geschäftsanschrift (= Privatadresse aus dem Impressum) auftauchen.
 */
export const UEBERGABE_HINWEIS =
  "Übergabe und Rückgabe erfolgen ausschließlich nach Terminvereinbarung — an unserem Treffpunkt (Grillhütte Sandwiese, Alsbach-Hähnlein) oder per vereinbarter Lieferung. Eine Abholung an unserer Geschäftsanschrift ist nicht möglich.";

/**
 * Hinweis für die Kundenkommunikation, wenn ein Faltzelt MIT Aufbau-Service gebucht wird:
 * ein Faltzelt lässt sich nicht sicher allein aufstellen, daher muss vor Ort mindestens eine
 * Person mithelfen. Erscheint nur bei Faltzelt-Positionen + gebuchtem Aufbau (Warenkorb,
 * Angebot-PDF, Bestätigungs-Mail).
 */
export const AUFBAU_HELFER_HINWEIS =
  "Bitte beachten: Beim Aufbau der Zelte wird vor Ort mindestens eine helfende Person benötigt — ein Faltzelt lässt sich nicht sicher allein aufstellen.";

/** True, wenn eine der Positions-Bezeichnungen ein Faltzelt ist (Aufbau-Helfer-Hinweis-Trigger). */
export function enthaeltFaltzelt(bezeichnungen: string[]): boolean {
  return bezeichnungen.some((b) => /faltzelt/i.test(b));
}

/**
 * AP1 — Baut den Leistungsumfang-Text (Manuel-Wortlaut) für Angebot-Seite, Admin-Vorschau UND
 * Angebot-PDF aus EINER Quelle, damit alle Ausgaben konsistent bleiben.
 *
 * Regeln (mit Manuel abgestimmt, 2026-07-13):
 * - Abbau macht IMMER der Kunde — es gibt keinen Abbau-Service.
 * - Helfer-Satz nur wenn ein Faltzelt MIT Aufbau gebucht ist.
 * - Abbau-Satz nur wenn ein Liefer-/Abholservice besteht (bei reiner Selbstabholung nimmt der
 *   Kunde alles selbst mit → kein Abbau-/Abhol-Bezug).
 */
export function buildLeistungstext(opts: {
  hasLieferung: boolean;
  hasAbholung: boolean;
  hasAufbau: boolean;
  hatFaltzelt: boolean;
}): string {
  const { hasLieferung, hasAbholung, hasAufbau, hatFaltzelt } = opts;
  const hasAnyLogistik = hasLieferung || hasAbholung;

  let grund: string;
  if (!hasAnyLogistik) {
    grund =
      "Abholung am Treffpunkt Grillhütte Sandwiese (Freizeitanlage), Alsbach-Hähnlein — den Termin sprechen wir telefonisch ab. Lieferung und Aufbau gegen Aufpreis möglich.";
  } else if (hasLieferung && hasAbholung) {
    grund = `Wir liefern an Ihre Adresse${hasAufbau ? ", bauen die Artikel vor Ort auf" : ""} und holen sie nach dem Event wieder ab.`;
  } else if (hasLieferung) {
    grund = `Wir liefern an Ihre Adresse${hasAufbau ? " und bauen die Artikel vor Ort auf" : ""}. Die Rückgabe erfolgt durch Sie am Treffpunkt Grillhütte Sandwiese, Alsbach-Hähnlein.`;
  } else {
    grund = `Selbstanlieferung am Treffpunkt Grillhütte Sandwiese, Alsbach-Hähnlein${hasAufbau ? "; wir bauen die Artikel vor Ort für Sie auf" : ""}. Wir holen sie nach dem Event bei Ihnen ab.`;
  }

  const helfer = hatFaltzelt && hasAufbau
    ? "Bitte beachten Sie: Für den Aufbau der Zelte wird vor Ort mindestens eine helfende Person benötigt, da sich ein Faltzelt nicht sicher allein aufstellen lässt."
    : "";

  let abbau = "";
  if (hasAbholung) {
    abbau =
      "Der Abbau ist nicht im Service enthalten — bitte bauen Sie die Artikel vor der Abholung ab und stellen sie abholbereit bereit.";
  } else if (hasLieferung) {
    abbau = "Der Abbau ist nicht im Service enthalten — bitte bauen Sie die Artikel vor der Rückgabe ab.";
  }

  return [grund, helfer, abbau].filter(Boolean).join(" ");
}
