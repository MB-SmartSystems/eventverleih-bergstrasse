// Maßstäbliche schematische Draufsicht (40 px/m). Vier Aufbau-Modi:
//  • single   : 1 Tisch — 3 je Langseite + 1 je Schmalseite (bis 8).
//  • block    : 2 Tische parallel (breite Seiten aneinander) im 3×3 — bis 10.
//  • row      : 2–3 Tische in Reihe (Stirnseiten aneinander) im 3×6 — bis 20.
//  • parallel : 3 Tische hochkant nebeneinander im 3×6 — 8/Tisch, bis 24.
// Sitz-Füllregel: zuerst Langseiten (3 je Tischseite, in fester Reihenfolge, Tisch
// für Tisch, eng), dann Stehenseiten — NIE an einer Stoßfläche. Tisch 1,82 × 0,74 m.

interface SetLayoutSvgProps {
  zelt: "3x3" | "3x6";
  tische: number;
  stuehle: number;
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

// single: 1 Tisch horizontal. Langseiten 3+3 (Reihenfolge L-oben,L-unten,M-oben,…),
// dann 2 Stehenseiten.
function buildSingle(): { tables: Rect[]; slots: Pt[] } {
  const x = -TL / 2, y = -TW / 2;
  const [xl, xm, xr] = drittel(x, TL);
  const top = y - OFF, bot = y + TW + OFF;
  const slots: Pt[] = [
    { x: xl, y: top }, { x: xl, y: bot },
    { x: xm, y: top }, { x: xm, y: bot },
    { x: xr, y: top }, { x: xr, y: bot },
    { x: x - OFF, y: 0 }, { x: x + TL + OFF, y: 0 },
  ];
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
function buildParallel(n: number): { tables: Rect[]; slots: Pt[] } {
  const pitch = TW + 2 * (OFF + CR); // Insel-Breite inkl. Stühle links/rechts
  const totalW = n * pitch;
  const startX = -totalW / 2;
  const yTop = -TL / 2;
  const tables: Rect[] = [];
  const slots: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const cx = startX + i * pitch + pitch / 2;
    const tx = cx - TW / 2;
    tables.push({ x: tx, y: yTop, w: TW, h: TL });
    const [yl, ym, yr] = drittel(yTop, TL); // 3 Höhen-Positionen
    const lx = tx - OFF, rx = tx + TW + OFF;
    slots.push(
      { x: lx, y: yl }, { x: rx, y: yl },
      { x: lx, y: ym }, { x: rx, y: ym },
      { x: lx, y: yr }, { x: rx, y: yr },
      { x: cx, y: yTop - OFF }, { x: cx, y: yTop + TL + OFF },
    );
  }
  return { tables, slots };
}

export default function SetLayoutSvg({ zelt, tische, stuehle }: SetLayoutSvgProps) {
  const isLang = zelt === "3x6";
  const tentW = (isLang ? 6 : 3) * PXM;
  const tentH = 3 * PXM;
  const tentX = -tentW / 2, tentY = -tentH / 2;

  const nT = Math.max(1, tische);
  const modus: "single" | "block" | "row" | "parallel" =
    nT <= 1 ? "single" : zelt === "3x3" ? "block" : stuehle >= 21 ? "parallel" : "row";

  const { tables, slots } =
    modus === "single" ? buildSingle()
      : modus === "block" ? buildBlock()
        : modus === "parallel" ? buildParallel(nT)
          : buildRow(nT);

  const chairs = slots.slice(0, Math.max(0, stuehle));

  const M = 16;
  const xs = [
    tentX, tentX + tentW,
    ...tables.flatMap((t) => [t.x, t.x + t.w]),
    ...chairs.map((c) => c.x - CR), ...chairs.map((c) => c.x + CR),
  ];
  const ys = [
    tentY, tentY + tentH,
    ...tables.flatMap((t) => [t.y, t.y + t.h]),
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
  const ariaLabel = `Maßstäbliche Skizze: ${isLang ? "3×6" : "3×3"}-Zelt mit ${tische} ${tische === 1 ? "Tisch" : "Tischen"}${modusWort} und ${stuehle} Stühlen`;

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
        fill="rgba(212,175,102,0.05)" stroke="#d4af66" strokeWidth={2} strokeDasharray="6 5"
      />
      {[
        [tentX, tentY], [tentX + tentW, tentY], [tentX, tentY + tentH], [tentX + tentW, tentY + tentH],
      ].map(([cx, cy], i) => (
        <circle key={`c-${i}`} cx={cx} cy={cy} r={4} fill="#d4af66" opacity={0.7} />
      ))}
      {tables.map((t, i) => (
        <rect
          key={`t-${i}`} x={t.x} y={t.y} width={t.w} height={t.h} rx={2} ry={2}
          fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2}
        />
      ))}
      {chairs.map((p, i) => (
        <circle key={`s-${i}`} cx={p.x} cy={p.y} r={CR} fill="rgba(212,175,102,0.85)" stroke="#8a6d2f" strokeWidth={1} />
      ))}
    </svg>
  );
}
