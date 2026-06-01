/**
 * Zentrale Zahlungs-Helfer.
 *
 * WICHTIG: `bezahlt` IMMER aus den Skalar-Feldern Anzahlung_/Restzahlung_Bezahlt_Eur
 * berechnen — die setzen BEIDE Wege (manuelle Erfassung in zahlung/route.ts UND der
 * Stripe-Webhook). Das Feld Zahlungen_JSON fuellt nur der manuelle Weg und ist bei
 * Stripe-bezahlten Buchungen leer -> jede Summe daraus war dort faelschlich 0
 * ("Offen = Gesamt" trotz Zahlung, falsche Storno-Erstattung). Zahlungen_JSON daher
 * nur noch als Historie-Liste nutzen, NIE als Summenquelle.
 */
export type BezahltFelder = {
  Anzahlung_Bezahlt_Eur?: string | number | null;
  Restzahlung_Bezahlt_Eur?: string | number | null;
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Tatsaechlich bezahlte Mietsumme (Anzahlung + Restzahlung), auf Cent gerundet. */
export function bezahltEur(b: BezahltFelder): number {
  return Math.round((num(b.Anzahlung_Bezahlt_Eur) + num(b.Restzahlung_Bezahlt_Eur)) * 100) / 100;
}

/** Geldbetrag fuer Kunden-Mails: deutsches Komma-Format, z.B. 12,50. */
export function eurMail(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
