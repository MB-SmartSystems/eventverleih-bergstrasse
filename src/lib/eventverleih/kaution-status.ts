/**
 * Einheitlicher Kaution-Status für Liste + Detail.
 *
 * Leitet aus den Kaution-Feldern einen klaren Hinweis ab: ist die Kaution offen
 * (noch nicht hinterlegt / nach Rückgabe noch nicht erstattet) oder abgeschlossen
 * (erstattet bzw. einbehalten). Reine Funktion, kein Baserow-Zugriff.
 */

export type KautionTone = "green" | "blue" | "amber" | "gray" | "red";

export interface KautionStatus {
  label: string;
  tone: KautionTone;
  /** true = Vorgang abgeschlossen (erstattet/einbehalten), false = noch offen */
  done: boolean;
}

export interface KautionInput {
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Kaution_Rueckzahlung_Eur?: string | number | null;
  Status_Erweitert?: { value: string } | string | null;
}

export const KAUTION_TONE_CLASSES: Record<KautionTone, string> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-800",
  gray: "bg-gray-100 text-gray-600",
  // Gemessen: 6,80:1 (#991b1b auf #fee2e2) — deutlich ueber der Schwelle 4,5:1.
  red: "bg-red-100 text-red-800",
};

/** Ware ist beim Kunden, hinterlegt ist nichts. Genau hier faengt das Risiko an. */
export const OHNE_KAUTION_UNTERWEGS = new Set(["Uebergeben", "In_Miete"]);

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Liefert den Kaution-Hinweis — oder null, wenn keine Kaution vereinbart ist. */
export function getKautionStatus(b: KautionInput): KautionStatus | null {
  const soll = num(b.Kaution_Soll_Eur);
  if (soll <= 0) return null;

  const status =
    typeof b.Status_Erweitert === "string" ? b.Status_Erweitert : b.Status_Erweitert?.value ?? "";

  // Abgeschlossen: es gab eine Rückzahlungs-/Einzugs-Buchung
  if (b.Kaution_Rueckzahlung_am) {
    const zurueck = num(b.Kaution_Rueckzahlung_Eur);
    if (zurueck <= 0) return { label: "Kaution einbehalten", tone: "gray", done: true };
    if (zurueck < soll) return { label: "Kaution tw. erstattet", tone: "green", done: true };
    return { label: "Kaution erstattet", tone: "green", done: true };
  }

  // Noch offen
  const zurueckgegeben = status === "Zurueckgegeben" || status === "Abgerechnet";
  if (b.Kaution_Hinterlegt_am) {
    // Nach Rückgabe hinterlegt, aber nicht erstattet → aktionspflichtig
    if (zurueckgegeben) return { label: "Kaution-Rückzahlung offen", tone: "amber", done: false };
    return { label: "Kaution hinterlegt", tone: "blue", done: false };
  }
  // Soll gesetzt, aber Kunde hat nichts hinterlegt.
  // Ist die Ware schon draussen, ist das kein offener Posten mehr, sondern ein
  // ungesichertes Risiko: die Uebergabe bleibt moeglich (Manuel, 2026-07-23), sie
  // wird aber rot ausgewiesen, damit sie nicht in der Menge der gelben Hinweise
  // untergeht.
  if (OHNE_KAUTION_UNTERWEGS.has(status)) {
    return { label: "Ohne Kaution übergeben", tone: "red", done: false };
  }
  return { label: "Kaution offen", tone: "amber", done: false };
}
