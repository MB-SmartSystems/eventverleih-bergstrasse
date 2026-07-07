// Maßstäbliche schematische Draufsicht (40 px/m).
//
// Ein Zelt (tents.length === 1): vier Aufbau-Modi wie bisher —
//  • single   : 1 Tisch — 3 je Langseite + 1 je Schmalseite (bis 8).
//  • block    : 2 Tische parallel (breite Seiten aneinander) im 3×3 — bis 10.
//  • row      : 2–3 Tische in Reihe (Stirnseiten aneinander) im 3×6 — bis 18.
//  • parallel : 3 Tische hochkant nebeneinander im 3×6 — 8/Tisch, ab 19 bis 24.
// Sitz-Füllregel: zuerst Langseiten (3 je Tischseite, in fester Reihenfolge, Tisch
// für Tisch, eng), dann Stehenseiten — NIE an einer Stoßfläche. Tisch 1,82 × 0,74 m.
//
// Zwei Zelte ("Mehr Platz", tents.length > 1): jedes Zelt bekommt seine Tische
// hochkant/parallel (je 8 Plätze), die Zelte grenzen Fuß an Fuß direkt aneinander.

import type { TentPlan } from "@/lib/eventverleih/set-empfehlung";

interface SetLayoutSvgProps {
  tents: TentPlan[];
}

interface Pt { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; }

const PXM = 40;
const TL = 1.82 * PXM; // Tischlänge  72,8
const TW = 0.74 * PXM; // Tischbreite 29,6
const CR = 9;          // Stuhl-Radius
const OFF = CR + 5;    // Kante → Stuhlmitte

// Drei Positionen je Langseite (links/mitte/rechts, Anteile 1/6, 1/2, 5/6).
function drittel(a: number, len: number): number[] {
  return [a + len / 6, a + len / 2, a + (len * 5) / 6];
}

// single: 1 Tisch horizontal. Wenige Stühle werden SYMMETRISCH über die Langseiten
// verteilt (nicht links geklumpt): pro Seite 1 → Mitte, 2 → links+rechts, 3 → alle.
// Aufteilung oben/unten möglichst gleich; Überschuss (7./8.) an die Stehenseiten.
// Beispiele: 3 = 2 oben (l+r) + 1 unten Mitte · 4 = 2 oben + 2 unten (je l+r).
function seiteVerteilt(cnt: number, xl: number, xm: number, xr: number): number[] {
  if (cnt <= 0) return [];
  if (cnt === 1) return [xm];
  if (cnt === 2) return [xl, xr];
  return [xl, xm, xr];
}
function buildSingle(stuehle: number): { tables: Rect[]; slots: Pt[] } {
  const x = -TL / 2, y = -TW / 2;
  const [xl, xm, xr] = drittel(x, TL);
  const top = y - OFF, bot = y + TW + OFF;
  const nLong = Math.min(Math.max(0, stuehle), 6);
  const oben = Math.ceil(nLong / 2);
  const unten = nLong - oben;
  const slots: Pt[] = [];
  seiteVerteilt(oben, xl, xm, xr).forEach((px) => slots.push({ x: px, y: top }));
  seiteVerteilt(unten, xl, xm, xr).forEach((px) => slots.push({ x: px, y: bot }));
  const rest = Math.max(0, stuehle) - nLong; // 0..2 → Stehenseiten
  if (rest >= 1) slots.push({ x: x - OFF, y: 0 });
  if (rest >= 2) slots.push({ x: x + TL + OFF, y: 0 });
  return { tables: [{ x, y, w: TL, h: TW }], slots };
}

// block: 2 Tische gestapelt (breite Seiten aneinander). Langseiten = Ober-/Unterkante
// (je 3), Stehenseiten = 2 links + 2 rechts (je Tisch-Mitte, NIE am Stoß). Bis 10.
function buildBlock(): { tables: Rect[]; slots: Pt[] } {
  const x = -TL / 2, yTop = -TW;
  const [xl, xm, xr] = drittel(x, TL);
  const top = yTop - OFF, bot = yTop + 2 * TW + OFF;
  const long: Pt[] = [
    { x: xl, y: top }, { x: xl, y: bot },
    { x: xm, y: top }, { x: xm, y: bot },
    { x: xr, y: top }, { x: xr, y: bot },
  ];
  const short: Pt[] = [
    { x: x - OFF, y: yTop + TW / 2 }, { x: x - OFF, y: yTop + TW + TW / 2 },
    { x: x + TL + OFF, y: yTop + TW / 2 }, { x: x + TL + OFF, y: yTop + TW + TW / 2 },
  ];
  return {
    tables: [
      { x, y: yTop, w: TL, h: TW },
      { x, y: yTop + TW, w: TL, h: TW },
    ],
    slots: [...long, ...short],
  };
}

// row: N Tische in Reihe. Je Tisch 6 Langseiten-Plätze (Tisch für Tisch), dann die
// 2 äußeren Stehenseiten. Stoßflächen bleiben frei. Bis 20 (3 Tische).
function buildRow(n: number): { tables: Rect[]; slots: Pt[] } {
  const totalW = n * TL;
  const x0 = -totalW / 2, y = -TW / 2;
  const top = y - OFF, bot = y + TW + OFF;
  const tables: Rect[] = [];
  const long: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const tx = x0 + i * TL;
    tables.push({ x: tx, y, w: TL, h: TW });
    const [xl, xm, xr] = drittel(tx, TL);
    long.push({ x: xl, y: top }, { x: xl, y: bot }, { x: xm, y: top }, { x: xm, y: bot }, { x: xr, y: top }, { x: xr, y: bot });
  }
  const short: Pt[] = [
    { x: x0 - OFF, y: 0 },
    { x: x0 + totalW + OFF, y: 0 },
  ];
  return { tables, slots: [...long, ...short] };
}

// parallel: N Tische hochkant nebeneinander (eigene Inseln, je 8). Langseiten links/rechts
// (je 3), Stehenseiten oben/unten (je 1). Tisch für Tisch. Bis 24 (3 Tische).
function buildParallel(n: number, spreadW?: number): { tables: Rect[]; slots: Pt[] } {
  const minPitch = TW + 2 * (OFF + CR); // Insel-Breite inkl. Stühle links/rechts (Minimum)
  // Wenn eine Zelt-Breite übergeben wird (Zwei-Zelt-Fall): die Tische über die
  // Zeltbreite VERTEILEN statt eng zusammen (nie enger als minPitch). Ohne spreadW
  // (Ein-Zelt-"parallel"-Modus) bleibt es beim Minimum → keine Regression.
  const pitch =
    spreadW && n > 1
      ? Math.max(minPitch, (spreadW - 2 * (OFF + CR + 6)) / n)
      : minPitch;
  const totalW = n * pitch;
  const startX = -totalW / 2;
  const yTop = -TL / 2;
  const [yl, ym, yr] = drittel(yTop, TL); // 3 Höhen-Positionen (Langseiten links/rechts)
  const tables: Rect[] = [];
  const lang: Pt[] = [];
  const steh: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const cx = startX + i * pitch + pitch / 2;
    const tx = cx - TW / 2;
    tables.push({ x: tx, y: yTop, w: TW, h: TL });
    const lx = tx - OFF, rx = tx + TW + OFF;
    lang.push(
      { x: lx, y: yl }, { x: rx, y: yl },
      { x: lx, y: ym }, { x: rx, y: ym },
      { x: lx, y: yr }, { x: rx, y: yr },
    );
    steh.push({ x: cx, y: yTop - OFF }, { x: cx, y: yTop + TL + OFF });
  }
  // Erst ALLE Langseiten (6 je Tisch), dann die Stirnseiten (2 je Tisch) — Stehenseiten
  // zuletzt. → z.B. bei 21: Tisch 1 = 8, Tisch 2 = 7, Tisch 3 = 6.
  return { tables, slots: [...lang, ...steh] };
}

// Ein-Zelt-Layout: exakt das bisherige Verhalten (Regressionsschutz — pixelgleich).
function renderTentEinzeln(zelt: "3x3" | "3x6", tische: number, stuehle: number) {
  const isLang = zelt === "3x6";
  const tentW = (isLang ? 6 : 3) * PXM;
  const tentH = 3 * PXM;

  const nT = Math.max(1, tische);
  const modus: "single" | "block" | "row" | "parallel" =
    nT <= 1 ? "single" : zelt === "3x3" ? "block" : stuehle >= 19 ? "parallel" : "row";

  const { tables, slots } =
    modus === "single" ? buildSingle(stuehle)
      : modus === "block" ? buildBlock()
        : modus === "parallel" ? buildParallel(nT)
          : buildRow(nT);

  const chairs = slots.slice(0, Math.max(0, stuehle));
  return { tables, chairs, tentW, tentH, modus };
}

// Zwei-Zelt-Layout: jedes Zelt bekommt seine Tische HOCHKANT/parallel (wie der
// Ein-Zelt-"parallel"-Modus) — Manuels Wunsch: im Mehr-Platz-Fall stehen die Tische
// parallel, nicht in Reihe. Jeder Tisch trägt bis 8 (Langseiten zuerst, dann Stirnseiten).
function renderTentParallel(zelt: "3x3" | "3x6", tische: number, stuehle: number) {
  const isLang = zelt === "3x6";
  const tentW = (isLang ? 6 : 3) * PXM;
  const tentH = 3 * PXM;
  const nT = Math.max(1, tische);
  const { tables, slots } = buildParallel(nT, tentW); // über die Zeltbreite verteilt
  const chairs = slots.slice(0, Math.max(0, stuehle));
  return { tables, chairs, tentW, tentH };
}

const TENT_FILL = "rgba(212,175,102,0.05)";
const TENT_STROKE = "#d4af66";
const TABLE_FILL = "rgba(255,255,255,0.10)";
const TABLE_STROKE = "rgba(255,255,255,0.45)";
const CHAIR_FILL = "rgba(212,175,102,0.85)";
const CHAIR_STROKE = "#8a6d2f";

export default function SetLayoutSvg({ tents }: SetLayoutSvgProps) {
  const safeTents: TentPlan[] = tents.length > 0 ? tents : [{ zelt: "3x3", tische: 1, stuehle: 0 }];

  // ---- Ein Zelt: exakt wie bisher (keine pixelmäßige Änderung). ----
  if (safeTents.length === 1) {
    const t = safeTents[0];
    const { tables, chairs, tentW, tentH, modus } = renderTentEinzeln(t.zelt, t.tische, t.stuehle);
    const tentX = -tentW / 2, tentY = -tentH / 2;
    const isLang = t.zelt === "3x6";

    const M = 16;
    const xs = [
      tentX, tentX + tentW,
      ...tables.flatMap((tt) => [tt.x, tt.x + tt.w]),
      ...chairs.map((c) => c.x - CR), ...chairs.map((c) => c.x + CR),
    ];
    const ys = [
      tentY, tentY + tentH,
      ...tables.flatMap((tt) => [tt.y, tt.y + tt.h]),
      ...chairs.map((c) => c.y - CR), ...chairs.map((c) => c.y + CR),
    ];
    const minX = Math.min(...xs) - M;
    const minY = Math.min(...ys) - M;
    const vbW = Math.max(...xs) - minX + M;
    const vbH = Math.max(...ys) - minY + M;

    const modusWort =
      modus === "block" ? " (parallel)"
        : modus === "parallel" ? " (hochkant)"
          : modus === "row" ? " (in Reihe)"
            : "";
    const ariaLabel = `Maßstäbliche Skizze: ${isLang ? "3×6" : "3×3"}-Zelt mit ${t.tische} ${t.tische === 1 ? "Tisch" : "Tischen"}${modusWort} und ${t.stuehle} Stühlen`;

    return (
      <svg
        viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <rect
          x={tentX} y={tentY} width={tentW} height={tentH} rx={10} ry={10}
          fill={TENT_FILL} stroke={TENT_STROKE} strokeWidth={2} strokeDasharray="6 5"
        />
        {[
          [tentX, tentY], [tentX + tentW, tentY], [tentX, tentY + tentH], [tentX + tentW, tentY + tentH],
        ].map(([cx, cy], i) => (
          <circle key={`c-${i}`} cx={cx} cy={cy} r={4} fill={TENT_STROKE} opacity={0.7} />
        ))}
        {tables.map((tt, i) => (
          <rect
            key={`t-${i}`} x={tt.x} y={tt.y} width={tt.w} height={tt.h} rx={2} ry={2}
            fill={TABLE_FILL} stroke={TABLE_STROKE} strokeWidth={1.2}
          />
        ))}
        {chairs.map((p, i) => (
          <circle key={`s-${i}`} cx={p.x} cy={p.y} r={CR} fill={CHAIR_FILL} stroke={CHAIR_STROKE} strokeWidth={1} />
        ))}
      </svg>
    );
  }

  // ---- Mehrere Zelte ("Mehr Platz"): Insel-Anordnung, Zelte nebeneinander. ----
  interface TentLayout {
    tables: Rect[];
    chairs: Pt[];
    tentW: number;
    tentH: number;
    tentX: number;
    tentY: number;
    dx: number;
  }

  // Fuß an Fuß: die Zelte grenzen direkt aneinander (kein Abstand). Kantenbasiert
  // platziert — die linke Kante von Zelt i+1 liegt auf der rechten Kante von Zelt i.
  const GAP = 0;
  let rightEdge = 0;
  const layouts: TentLayout[] = safeTents.map((t) => {
    const { tables, chairs, tentW, tentH } = renderTentParallel(t.zelt, t.tische, t.stuehle);
    const tentX = -tentW / 2, tentY = -tentH / 2;
    const leftEdge = rightEdge + GAP;
    const dx = leftEdge + tentW / 2; // Zelt-Rahmen ist um den lokalen Ursprung zentriert
    rightEdge = leftEdge + tentW;
    return { tables, chairs, tentW, tentH, tentX, tentY, dx };
  });

  const M = 16;
  const xs: number[] = [];
  const ys: number[] = [];
  layouts.forEach((l) => {
    xs.push(l.dx + l.tentX, l.dx + l.tentX + l.tentW);
    ys.push(l.tentY, l.tentY + l.tentH);
    l.tables.forEach((tt) => xs.push(l.dx + tt.x, l.dx + tt.x + tt.w));
    l.chairs.forEach((c) => {
      xs.push(l.dx + c.x - CR, l.dx + c.x + CR);
      ys.push(c.y - CR, c.y + CR);
    });
  });
  const minX = Math.min(...xs) - M;
  const minY = Math.min(...ys) - M;
  const vbW = Math.max(...xs) - minX + M;
  const vbH = Math.max(...ys) - minY + M;

  const totalTische = safeTents.reduce((s, t) => s + t.tische, 0);
  const totalStuehle = safeTents.reduce((s, t) => s + t.stuehle, 0);
  const zeltWort = safeTents.map((t) => (t.zelt === "3x6" ? "3×6" : "3×3")).join(" + ");
  const ariaLabel = `Maßstäbliche Skizze: ${safeTents.length} Zelte (${zeltWort}) mit insgesamt ${totalTische} ${totalTische === 1 ? "Tisch" : "Tischen"} und ${totalStuehle} Stühlen`;

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {layouts.map((l, ti) => (
        <g key={`tent-${ti}`} transform={`translate(${l.dx},0)`}>
          <rect
            x={l.tentX} y={l.tentY} width={l.tentW} height={l.tentH} rx={10} ry={10}
            fill={TENT_FILL} stroke={TENT_STROKE} strokeWidth={2} strokeDasharray="6 5"
          />
          {[
            [l.tentX, l.tentY], [l.tentX + l.tentW, l.tentY], [l.tentX, l.tentY + l.tentH], [l.tentX + l.tentW, l.tentY + l.tentH],
          ].map(([cx, cy], i) => (
            <circle key={`c-${ti}-${i}`} cx={cx} cy={cy} r={4} fill={TENT_STROKE} opacity={0.7} />
          ))}
          {l.tables.map((tt, i) => (
            <rect
              key={`t-${ti}-${i}`} x={tt.x} y={tt.y} width={tt.w} height={tt.h} rx={2} ry={2}
              fill={TABLE_FILL} stroke={TABLE_STROKE} strokeWidth={1.2}
            />
          ))}
          {l.chairs.map((p, i) => (
            <circle key={`s-${ti}-${i}`} cx={p.x} cy={p.y} r={CR} fill={CHAIR_FILL} stroke={CHAIR_STROKE} strokeWidth={1} />
          ))}
        </g>
      ))}
    </svg>
  );
}
