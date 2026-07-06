// Reine Gästezahl → Set-Logik. Keine React/Baserow-Abhängigkeit (testbar).
// Spec: docs/superpowers/specs/2026-07-06-gaestezahl-set-empfehlung-design.md

export const SLUGS = {
  zelt3x3: "faltzelt-3x3m",
  zelt3x6: "faltzelt-3x6m",
  stuhl: "stuhl",
  tisch: "klapptisch",
  tischdecke: "tischdecke",
  wandFenster: "seitenwand-fenster",
  wandReissverschluss: "seitenwand-reissverschluss",
  gewicht: "metallplatten-gewicht",
  lichterkette: "lichterkette-18m",
  stehtisch: "stehtisch-mit-husse",
  heizpilz: "heizstrahler",
  gasflasche: "gasflasche-11kg",
} as const;

export const MIN_GAESTE = 2;
const EINZELZELT_KAP = 24; // ein 3×6-Zelt fasst max. 24 Sitzplätze

export interface SetPos {
  slug: string;
  anzahl: number;
}

export interface SetEmpfehlung {
  gueltig: boolean; // false wenn G < MIN_GAESTE oder G > maxGaeste oder keine Ganzzahl
  zelt: "3x3" | "3x6";
  tische: number;
  stuehle: number;
  positionen: SetPos[]; // Auto-in-Warenkorb
  maxGaeste: number;
}

/** MAX_G aus Bestand: min(Stühle, Tische×8, Einzelzelt-Kapazität). */
export function maxGaeste(bestand: { stuhl: number; tisch: number }): number {
  return Math.max(0, Math.min(bestand.stuhl, bestand.tisch * 8, EINZELZELT_KAP));
}

/**
 * Vollständiges Auto-Set für eine Gästezahl (Mengen + Zeltgröße).
 * Das kleine 3×3-Zelt reicht bis 10 Gäste (ab 11 braucht die Tafel das 3×6).
 * Im ≤10-Bereich kann der Kunde freiwillig aufs große Zelt umschalten (`grossesZelt`).
 */
export function empfehlung(
  g: number,
  bestand: { stuhl: number; tisch: number },
  grossesZelt: boolean = false,
): SetEmpfehlung {
  const maxG = maxGaeste(bestand);
  const kleinesReicht = g <= 10;
  const zelt: "3x3" | "3x6" = kleinesReicht && !grossesZelt ? "3x3" : "3x6";
  const tische = Math.ceil(g / 8);
  const gueltig = Number.isInteger(g) && g >= MIN_GAESTE && g <= maxG;
  const beine = zelt === "3x6" ? 6 : 4;
  const fenster = zelt === "3x6" ? 4 : 2; // immer 2 Reißverschluss, Rest Fenster
  const positionen: SetPos[] = [
    { slug: SLUGS.stuhl, anzahl: g },
    { slug: SLUGS.tisch, anzahl: tische },
    { slug: SLUGS.tischdecke, anzahl: tische },
    { slug: zelt === "3x6" ? SLUGS.zelt3x6 : SLUGS.zelt3x3, anzahl: 1 },
    { slug: SLUGS.wandReissverschluss, anzahl: 2 },
    { slug: SLUGS.wandFenster, anzahl: fenster },
    { slug: SLUGS.gewicht, anzahl: beine },
    { slug: SLUGS.lichterkette, anzahl: 1 },
  ];
  return { gueltig, zelt, tische, stuehle: g, positionen, maxGaeste: maxG };
}

/**
 * Optionale Zusatz-Empfehlungen (NICHT auto in den Warenkorb): Stehtisch immer,
 * Heizpilz nur in der kalten Jahreszeit (Okt–Apr). `monat1bis12` = 1..12.
 */
export function zusatzEmpfehlungen(monat1bis12: number): string[] {
  const out: string[] = [SLUGS.stehtisch];
  if (monat1bis12 >= 10 || monat1bis12 <= 4) out.push(SLUGS.heizpilz);
  return out;
}
