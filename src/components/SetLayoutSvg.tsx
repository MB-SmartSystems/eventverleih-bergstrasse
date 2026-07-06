// Schematische Draufsicht eines Sets: Zelt-Rahmen, eine Tafel aus N Tischen,
// Stühle entlang der Tafel. Rein deterministisch (keine Zufalls-/Datumslogik),
// keine Fremd-Lib — nur Inline-SVG. Dient als grobe Orientierung, kein Maßplan.

interface SetLayoutSvgProps {
  zelt: "3x3" | "3x6";
  tische: number;
  stuehle: number;
}

interface Pt {
  x: number;
  y: number;
}

// Verteilt `n` Stühle als Kreis-Positionen um die Tafel herum. Priorität auf den
// beiden Langseiten (oben/unten), Überschuss wandert an die Schmalseiten.
function chairPositions(
  tafelX: number,
  tafelY: number,
  tafelW: number,
  tafelH: number,
  n: number,
  offset: number,
): Pt[] {
  const pts: Pt[] = [];
  if (n <= 0) return pts;

  const capLong = Math.max(1, Math.floor(tafelW / 24));
  const topN = Math.min(Math.ceil(n / 2), capLong);
  let rest = n - topN;
  const bottomN = Math.min(rest, capLong);
  rest -= bottomN;
  const leftN = Math.ceil(rest / 2);
  const rightN = rest - leftN;

  for (let i = 0; i < topN; i++) {
    pts.push({ x: tafelX + (tafelW * (i + 1)) / (topN + 1), y: tafelY - offset });
  }
  for (let i = 0; i < bottomN; i++) {
    pts.push({ x: tafelX + (tafelW * (i + 1)) / (bottomN + 1), y: tafelY + tafelH + offset });
  }
  for (let i = 0; i < leftN; i++) {
    pts.push({ x: tafelX - offset, y: tafelY + (tafelH * (i + 1)) / (leftN + 1) });
  }
  for (let i = 0; i < rightN; i++) {
    pts.push({ x: tafelX + tafelW + offset, y: tafelY + (tafelH * (i + 1)) / (rightN + 1) });
  }
  return pts;
}

export default function SetLayoutSvg({ zelt, tische, stuehle }: SetLayoutSvgProps) {
  const isLang = zelt === "3x6";
  const W = isLang ? 360 : 240;
  const H = isLang ? 200 : 240;

  // Zelt-Rahmen
  const pad = 12;
  const frameX = pad;
  const frameY = pad;
  const frameW = W - pad * 2;
  const frameH = H - pad * 2;

  // Tafel: N Tische in EINER Reihe zusammengeschoben, zentriert.
  const tafelH = 30;
  const nT = Math.max(1, tische);
  const chairRoom = 34; // Platz für Stühle + Rand links/rechts der Tafel
  const availW = frameW - chairRoom * 2;
  const unitW = Math.min(56, availW / nT);
  const tafelW = unitW * nT;
  const tafelX = (W - tafelW) / 2;
  const tafelY = (H - tafelH) / 2;

  const chairR = 6;
  const chairs = chairPositions(tafelX, tafelY, tafelW, tafelH, stuehle, 13);

  const zeltLabel = isLang ? "3×6" : "3×3";
  const tischWort = tische === 1 ? "Tisch" : "Tischen";
  const stuhlWort = stuehle === 1 ? "Stuhl" : "Stühlen";
  const ariaLabel = `Skizze: ${zeltLabel}-Zelt mit ${tische} ${tischWort} und ${stuehle} ${stuhlWort}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Zelt-Rahmen */}
      <rect
        x={frameX}
        y={frameY}
        width={frameW}
        height={frameH}
        rx={16}
        ry={16}
        fill="rgba(212,175,102,0.05)"
        stroke="#d4af66"
        strokeWidth={2}
        strokeDasharray="6 5"
      />
      {/* Zelt-Ecken (Gewichte/Beine) andeuten */}
      {[
        [frameX, frameY],
        [frameX + frameW, frameY],
        [frameX, frameY + frameH],
        [frameX + frameW, frameY + frameH],
      ].map(([cx, cy], i) => (
        <circle key={`corner-${i}`} cx={cx} cy={cy} r={4} fill="#d4af66" opacity={0.7} />
      ))}

      {/* Tafel: einzelne Tische nebeneinander */}
      {Array.from({ length: nT }).map((_, i) => (
        <rect
          key={`tisch-${i}`}
          x={tafelX + i * unitW}
          y={tafelY}
          width={unitW}
          height={tafelH}
          rx={3}
          ry={3}
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.5}
        />
      ))}

      {/* Stühle */}
      {chairs.map((p, i) => (
        <circle
          key={`stuhl-${i}`}
          cx={p.x}
          cy={p.y}
          r={chairR}
          fill="rgba(212,175,102,0.85)"
          stroke="#8a6d2f"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
