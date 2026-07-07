// Reine Gästezahl → Set-Logik. Keine React/Baserow-Abhängigkeit (testbar).
// Spec: docs/superpowers/specs/2026-07-06-gaestezahl-set-empfehlung-design.md
// v2 (Zweitzelt/"Mehr Platz"): siehe Abschnitt "v2" am Ende derselben Spec-Datei.

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
// Bis zu 4 Tische werden geplant (30 Gäste). Der 4. Tisch (+ Tischdecke) ist nicht im
// Dauerbestand — Manuel kauft ihn erst, wenn tatsächlich eine 25–30-Personen-Anfrage
// kommt. Das Tool rechnet aber schon bis 30, damit solche Anfragen überhaupt reinkommen.
const MAX_TISCHE_PLANBAR = 4;

export interface SetPos {
  slug: string;
  anzahl: number;
}

/** Ein einzelnes Zelt im Plan: seine Größe, wie viele Tische es trägt und wie viele Stühle. */
export interface TentPlan {
  zelt: "3x3" | "3x6";
  tische: number;
  stuehle: number;
}

export interface SetEmpfehlung {
  gueltig: boolean; // false wenn G < MIN_GAESTE oder G > maxGaeste oder keine Ganzzahl
  zelt: "3x3" | "3x6"; // = zelte[0].zelt (Rückwärtskompatibilität)
  tische: number; // Gesamtzahl Tische über alle Zelte
  stuehle: number;
  positionen: SetPos[]; // Auto-in-Warenkorb
  maxGaeste: number;
  zelte: TentPlan[]; // 1 Eintrag im Standard-Fall, 2 bei "Mehr Platz"
  mehrPlatzMoeglich: boolean; // Toggle wird nur ab 3 Tischen angeboten
}

/**
 * MAX_G: min(Stühle, 4 Tische × 8). NICHT am aktuellen Tisch-Bestand gedeckelt —
 * bis 4 Tische (30 Gäste) wird geplant, der 4. Tisch wird bei Bedarf gekauft.
 * Chairs (30) sind damit die reale Obergrenze.
 */
export function maxGaeste(bestand: { stuhl: number; tisch: number }): number {
  return Math.max(0, Math.min(bestand.stuhl, MAX_TISCHE_PLANBAR * 8));
}

/**
 * Greedy-Zeltplaner: verteilt `tische` Tische auf verfügbare 3×6- (Kapazität `bigCap`
 * pro Zelt) und 3×3-Zelte (Kapazität 1 pro Zelt). Ein letzter Rest-Tisch wandert
 * bevorzugt in ein kleines 3×3-Zelt (statt ein weiteres großes Zelt anzubrechen).
 */
function greedyZeltplan(
  tische: number,
  zelt3x6: number,
  zelt3x3: number,
  bigCap: number,
): { zelt: "3x3" | "3x6"; tische: number }[] {
  let rem = tische;
  let big = zelt3x6;
  let small = zelt3x3;
  const tents: { zelt: "3x3" | "3x6"; tische: number }[] = [];
  while (rem > 0) {
    if (rem <= 1 && small > 0 && tents.length > 0) {
      tents.push({ zelt: "3x3", tische: 1 });
      small--;
      rem--;
      continue;
    }
    if (big > 0) {
      const t = Math.min(bigCap, rem);
      tents.push({ zelt: "3x6", tische: t });
      big--;
      rem -= t;
      continue;
    }
    if (small > 0) {
      const t = Math.min(1, rem);
      tents.push({ zelt: "3x3", tische: t });
      small--;
      rem -= t;
      continue;
    }
    break; // kein Bestand mehr — Rest bleibt unberücksichtigt (Randfall, sollte durch maxGaeste nie erreicht werden)
  }
  return tents;
}

/**
 * Vollständiges Auto-Set für eine Gästezahl (Mengen + Zeltgröße(n)).
 * Das kleine 3×3-Zelt reicht bis 10 Gäste (ab 11 braucht die Tafel das 3×6).
 * Im ≤10-Bereich kann der Kunde freiwillig aufs große Zelt umschalten (`grossesZelt`).
 * Ab 3 Tischen kann der Kunde zusätzlich auf "Mehr Platz" (`mehrPlatz`) umschalten:
 * die Tische verteilen sich dann auf zwei luftigere Zelte statt auf eins.
 */
export function empfehlung(
  g: number,
  bestand: { stuhl: number; tisch: number; zelt3x6?: number; zelt3x3?: number },
  grossesZelt: boolean = false,
  mehrPlatz: boolean = false,
): SetEmpfehlung {
  const maxG = maxGaeste(bestand);
  const zelt3x6Bestand = bestand.zelt3x6 ?? 2;
  const zelt3x3Bestand = bestand.zelt3x3 ?? 2;

  // Tischzahl nach Sitz-Kapazität (nicht stur 8/Tisch). NICHT am aktuellen Tisch-Bestand
  // gedeckelt — ab 25 Gästen werden 4 Tische empfohlen (der 4. wird bei Bedarf gekauft),
  // aber maximal 4 (30 Gäste). Darüber greift der Fallback (persönliches Angebot).
  const tische = Math.min(
    MAX_TISCHE_PLANBAR,
    g <= 8 ? 1 : g <= 14 ? 2 : g <= 24 ? 3 : Math.ceil(g / 8),
  );
  const gueltig = Number.isInteger(g) && g >= MIN_GAESTE && g <= maxG;
  const mehrPlatzMoeglich = tische >= 3;
  const useMehrPlatz = mehrPlatz && mehrPlatzMoeglich;

  let plan: { zelt: "3x3" | "3x6"; tische: number }[];
  if (tische <= 0) {
    plan = [];
  } else if (!useMehrPlatz && tische <= 3) {
    // Standard, bis 3 Tische: EIN Zelt mit allen Tischen (reproduziert das bisherige
    // Live-Verhalten 1:1).
    const zeltGr: "3x3" | "3x6" = g <= 10 && !grossesZelt ? "3x3" : "3x6";
    plan = [{ zelt: zeltGr, tische }];
  } else {
    // Standard ab 4 Tischen (bigCap=3) ODER "Mehr Platz" ab 3 Tischen (bigCap=2).
    const bigCap = useMehrPlatz ? 2 : 3;
    plan = greedyZeltplan(tische, zelt3x6Bestand, zelt3x3Bestand, bigCap);
  }

  // Stuhlverteilung über die Zelte nach Manuels Füll-Regel (2026-07-07):
  //   1. ZUERST alle LANGSEITEN (6 pro Tisch), Zelt für Zelt in Reihenfolge.
  //   2. DANN die STEHENSEITEN (Stirnseiten, 2 pro Tisch) — ebenfalls Zelt für Zelt,
  //      also Zelt 1 komplett, bevor Zelt 2 eine Stehenseite bekommt.
  // Dadurch bleibt das letzte (kleine) Zelt am längsten ohne Stirnseiten-Plätze = luftiger.
  // Beispiel 3×6(2 T.)+3×3(1 T.): 19 → 13/6, 22 → 16/6, 23 → 16/7, 24 → 16/8.
  const tentStuehle = plan.map(() => 0);
  let rem = g;
  for (let i = 0; i < plan.length; i++) {
    const langCap = plan[i].tische * 6;
    const take = Math.min(langCap, Math.max(0, rem));
    tentStuehle[i] += take;
    rem -= take;
  }
  for (let i = 0; i < plan.length; i++) {
    const stehCap = plan[i].tische * 2;
    const take = Math.min(stehCap, Math.max(0, rem));
    tentStuehle[i] += take;
    rem -= take;
  }
  const zelte: TentPlan[] = plan.map((p, i) => ({
    zelt: p.zelt,
    tische: p.tische,
    stuehle: tentStuehle[i],
  }));

  // Positionen aggregieren (nach Slug summiert).
  const posMap = new Map<string, number>();
  const add = (slug: string, n: number) => posMap.set(slug, (posMap.get(slug) ?? 0) + n);

  add(SLUGS.stuhl, g);
  add(SLUGS.tisch, tische);
  add(SLUGS.tischdecke, tische);

  let n3x6 = 0;
  let n3x3 = 0;
  let reissv = 0;
  let fenster = 0;
  let gewicht = 0;
  for (const z of zelte) {
    if (z.zelt === "3x6") {
      n3x6++;
      reissv += 2;
      fenster += 4;
      gewicht += 6;
    } else {
      n3x3++;
      reissv += 2;
      fenster += 2;
      gewicht += 4;
    }
  }
  if (n3x6 > 0) add(SLUGS.zelt3x6, n3x6);
  if (n3x3 > 0) add(SLUGS.zelt3x3, n3x3);
  if (reissv > 0) add(SLUGS.wandReissverschluss, reissv);
  if (fenster > 0) add(SLUGS.wandFenster, fenster);
  if (gewicht > 0) add(SLUGS.gewicht, gewicht);
  if (n3x6 > 0 || n3x3 > 0) add(SLUGS.lichterkette, n3x6 + Math.ceil(n3x3 / 2));

  const positionen: SetPos[] = Array.from(posMap.entries())
    .filter(([, anzahl]) => anzahl > 0)
    .map(([slug, anzahl]) => ({ slug, anzahl }));

  const zeltHaupt: "3x3" | "3x6" = zelte[0]?.zelt ?? (g <= 10 && !grossesZelt ? "3x3" : "3x6");

  return {
    gueltig,
    zelt: zeltHaupt,
    tische,
    stuehle: g,
    positionen,
    maxGaeste: maxG,
    zelte,
    mehrPlatzMoeglich,
  };
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
