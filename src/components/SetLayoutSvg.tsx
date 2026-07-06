// Maßstäbliche schematische Draufsicht eines Sets (40 px/m). Drei Aufbau-Modi:
//  • single: 1 Tisch — 3 Stühle je Langseite + 1 je Schmalseite.
//  • block : 2 Tische parallel (lange Seiten aneinander) im 3×3 — Stühle rundum,
//            niemand an der (inneren) Stoßfläche.
//  • row   : Tische in Reihe (Stirnseiten aneinander) im 3×6 — Stühle an den
//            Langseiten, niemand an der Stoßfläche.
// Tisch 1,82 × 0,74 m, Zelt 3×3 / 3×6 m — Verhältnis stimmt; Überlauf wird sichtbar.
// Rein deterministisch, keine Fremd-Lib.

interface SetLayoutSvgProps {
  zelt: "3x3" | "3x6";
  tische: number;
  stuehle: number;
}

interface Pt {
  x: number;
  y: number;
}

const PX_PER_M = 40;
const TABLE_L = 1.82 * PX_PER_M; // Tischlänge (Langseite)  = 72,8 px
const TABLE_W = 0.74 * PX_PER_M; // Tischbreite (Schmalseite) = 29,6 px
const CHAIR_R = 9;
const CHAIR_OFF = CHAIR_R + 5;

// Reihe / Einzeltisch: Stühle an den beiden Langseiten (3 je Tisch), Überschuss
// (max. 2) an die äußeren Schmalseiten. Innere Stoßflächen bleiben frei.
function chairsRow(x: number, y: number, w: number, h: number, tische: number, stuehle: number): Pt[] {
  const pts: Pt[] = [];
  if (stuehle <= 0) return pts;
  const longCap = 3 * Math.max(1, tische);
  const onLong = Math.min(stuehle, longCap * 2);
  const top = Math.ceil(onLong / 2);
  const bottom = onLong - top;
  const rest = stuehle - onLong;
  const leftEnd = rest >= 1 ? 1 : 0;
  const rightEnd = rest >= 2 ? 1 : 0;
  for (let i = 0; i < top; i++) pts.push({ x: x + (w * (i + 1)) / (top + 1), y: y - CHAIR_OFF });
  for (let i = 0; i < bottom; i++) pts.push({ x: x + (w * (i + 1)) / (bottom + 1), y: y + h + CHAIR_OFF });
  if (leftEnd) pts.push({ x: x - CHAIR_OFF, y: y + h / 2 });
  if (rightEnd) pts.push({ x: x + w + CHAIR_OFF, y: y + h / 2 });
  return pts;
}

// Block (2 Tische parallel gestapelt): 3 Stühle je lange Kante (oben/unten),
// 2 je kurze Kante (links/rechts) = bis 10. Innere Stoßfläche bleibt frei.
function chairsBlock(x: number, y: number, w: number, h: number, stuehle: number): Pt[] {
  const pts: Pt[] = [];
  let rem = Math.max(0, stuehle);
  const top = Math.min(rem, 3); rem -= top;
  const bottom = Math.min(rem, 3); rem -= bottom;
  const left = Math.min(rem, 2); rem -= left;
  const right = Math.min(rem, 2); rem -= right;
  for (let i = 0; i < top; i++) pts.push({ x: x + (w * (i + 1)) / (top + 1), y: y - CHAIR_OFF });
  for (let i = 0; i < bottom; i++) pts.push({ x: x + (w * (i + 1)) / (bottom + 1), y: y + h + CHAIR_OFF });
  for (let i = 0; i < left; i++) pts.push({ x: x - CHAIR_OFF, y: y + (h * (i + 1)) / (left + 1) });
  for (let i = 0; i < right; i++) pts.push({ x: x + w + CHAIR_OFF, y: y + (h * (i + 1)) / (right + 1) });
  return pts;
}

export default function SetLayoutSvg({ zelt, tische, stuehle }: SetLayoutSvgProps) {
  const isLang = zelt === "3x6";
  const tentW = (isLang ? 6 : 3) * PX_PER_M;
  const tentH = 3 * PX_PER_M;
  const tentX = -tentW / 2;
  const tentY = -tentH / 2;

  const nT = Math.max(1, tische);
  const modus: "single" | "row" | "block" = nT <= 1 ? "single" : zelt === "3x3" ? "block" : "row";

  const tables: { x: number; y: number }[] = [];
  let chairs: Pt[];

  if (modus === "block") {
    // Tische parallel gestapelt → Block TABLE_L × (TABLE_W·nT)
    const bw = TABLE_L;
    const bh = TABLE_W * nT;
    const bx = -bw / 2;
    const by = -bh / 2;
    for (let i = 0; i < nT; i++) tables.push({ x: bx, y: by + i * TABLE_W });
    chairs = chairsBlock(bx, by, bw, bh, stuehle);
  } else {
    // Einzeltisch oder Reihe: horizontal nebeneinander
    const tw = TABLE_L * nT;
    const tx = -tw / 2;
    const ty = -TABLE_W / 2;
    for (let i = 0; i < nT; i++) tables.push({ x: tx + i * TABLE_L, y: ty });
    chairs = chairsRow(tx, ty, tw, TABLE_W, nT, stuehle);
  }

  const isBlock = modus === "block";
  const tblW = TABLE_L;
  const tblH = TABLE_W;

  // ViewBox = Bounding-Box über Zelt + Tische + Stühle (+ Rand) → Überlauf sichtbar.
  const M = 16;
  const xs = [
    tentX, tentX + tentW,
    ...tables.flatMap((t) => [t.x, t.x + tblW]),
    ...chairs.map((c) => c.x - CHAIR_R), ...chairs.map((c) => c.x + CHAIR_R),
  ];
  const ys = [
    tentY, tentY + tentH,
    ...tables.flatMap((t) => [t.y, t.y + tblH]),
    ...chairs.map((c) => c.y - CHAIR_R), ...chairs.map((c) => c.y + CHAIR_R),
  ];
  const minX = Math.min(...xs) - M;
  const minY = Math.min(...ys) - M;
  const vbW = Math.max(...xs) - minX + M;
  const vbH = Math.max(...ys) - minY + M;

  const zeltLabel = isLang ? "3×6" : "3×3";
  const tischWort = tische === 1 ? "Tisch" : "Tische";
  const modusWort = isBlock ? " (parallel)" : nT > 1 ? " (in Reihe)" : "";
  const ariaLabel = `Maßstäbliche Skizze: ${zeltLabel}-Zelt mit ${tische} ${tischWort}${modusWort} und ${stuehle} Stühlen`;

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <rect
        x={tentX}
        y={tentY}
        width={tentW}
        height={tentH}
        rx={10}
        ry={10}
        fill="rgba(212,175,102,0.05)"
        stroke="#d4af66"
        strokeWidth={2}
        strokeDasharray="6 5"
      />
      {[
        [tentX, tentY],
        [tentX + tentW, tentY],
        [tentX, tentY + tentH],
        [tentX + tentW, tentY + tentH],
      ].map(([cx, cy], i) => (
        <circle key={`corner-${i}`} cx={cx} cy={cy} r={4} fill="#d4af66" opacity={0.7} />
      ))}

      {tables.map((t, i) => (
        <rect
          key={`tisch-${i}`}
          x={t.x}
          y={t.y}
          width={tblW}
          height={tblH}
          rx={2}
          ry={2}
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.2}
        />
      ))}

      {chairs.map((p, i) => (
        <circle
          key={`stuhl-${i}`}
          cx={p.x}
          cy={p.y}
          r={CHAIR_R}
          fill="rgba(212,175,102,0.85)"
          stroke="#8a6d2f"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
