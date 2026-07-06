// Maßstäbliche schematische Draufsicht eines Sets: Zelt-Rahmen, eine Tafel aus N
// Tischen (in Reihe zusammengeschoben), Stühle 3 je Langseite + 1 je Schmalseite
// pro Tisch. Alles zu Maßstab (40 px/m): Zelt 3×3 m / 3×6 m, Tisch 1,82 × 0,74 m.
// Rein deterministisch, keine Fremd-Lib. Läuft die Tafel über das Zelt hinaus,
// wird das sichtbar dargestellt (ehrliche Proportion, kein Clipping).

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
const CHAIR_R = 9;               // ~0,45 m Stuhl
const CHAIR_OFF = CHAIR_R + 5;   // Abstand Tischkante → Stuhlmittelpunkt

/**
 * Stuhl-Positionen: pro Tisch max. 3 an jeder Langseite + 1 an jeder äußeren
 * Schmalseite (= 8/Tisch). Bei einer Tafel aus T Tischen fassen die Langseiten
 * 3·T je Seite; nur die zwei ÄUSSEREN Schmalseiten bekommen einen Stuhl (die
 * inneren Stoßkanten sind zusammengeschoben). Stühle werden gleichmäßig auf die
 * Langseiten verteilt, Überschuss (max. 2) an die Schmalseiten.
 */
function chairPositions(
  tafelX: number,
  tafelY: number,
  tafelW: number,
  tafelH: number,
  tische: number,
  stuehle: number,
): Pt[] {
  const pts: Pt[] = [];
  if (stuehle <= 0) return pts;

  const longCap = 3 * Math.max(1, tische); // je Langseite
  const onLong = Math.min(stuehle, longCap * 2);
  const top = Math.ceil(onLong / 2);
  const bottom = onLong - top;
  const rest = stuehle - onLong; // 0..2 → Schmalseiten
  const leftEnd = rest >= 1 ? 1 : 0;
  const rightEnd = rest >= 2 ? 1 : 0;

  for (let i = 0; i < top; i++) {
    pts.push({ x: tafelX + (tafelW * (i + 1)) / (top + 1), y: tafelY - CHAIR_OFF });
  }
  for (let i = 0; i < bottom; i++) {
    pts.push({ x: tafelX + (tafelW * (i + 1)) / (bottom + 1), y: tafelY + tafelH + CHAIR_OFF });
  }
  if (leftEnd) pts.push({ x: tafelX - CHAIR_OFF, y: tafelY + tafelH / 2 });
  if (rightEnd) pts.push({ x: tafelX + tafelW + CHAIR_OFF, y: tafelY + tafelH / 2 });
  return pts;
}

export default function SetLayoutSvg({ zelt, tische, stuehle }: SetLayoutSvgProps) {
  const isLang = zelt === "3x6";

  // Zelt zu Maßstab (Tafel läuft entlang der Breite / langen Achse).
  const tentW = (isLang ? 6 : 3) * PX_PER_M;
  const tentH = 3 * PX_PER_M;

  // Tafel: N Tische in einer Reihe (Langseite horizontal), zentriert im Zelt.
  const nT = Math.max(1, tische);
  const tafelW = TABLE_L * nT;
  const tafelH = TABLE_W;

  // Alles um den gemeinsamen Mittelpunkt (0,0) legen.
  const tentX = -tentW / 2;
  const tentY = -tentH / 2;
  const tafelX = -tafelW / 2;
  const tafelY = -tafelH / 2;

  const chairs = chairPositions(tafelX, tafelY, tafelW, tafelH, nT, stuehle);

  // ViewBox = Bounding-Box über Zelt + Tafel + Stühle (+ Rand), damit ein
  // Überlauf sichtbar bleibt statt abgeschnitten zu werden.
  const M = 16;
  const xs = [tentX, tentX + tentW, tafelX, tafelX + tafelW, ...chairs.map((c) => c.x - CHAIR_R), ...chairs.map((c) => c.x + CHAIR_R)];
  const ys = [tentY, tentY + tentH, tafelY, tafelY + tafelH, ...chairs.map((c) => c.y - CHAIR_R), ...chairs.map((c) => c.y + CHAIR_R)];
  const minX = Math.min(...xs) - M;
  const minY = Math.min(...ys) - M;
  const vbW = Math.max(...xs) - minX + M;
  const vbH = Math.max(...ys) - minY + M;

  const zeltLabel = isLang ? "3×6" : "3×3";
  const tischWort = tische === 1 ? "Tisch" : "Tische";
  const stuhlWort = stuehle === 1 ? "Stuhl" : "Stühle";
  const ariaLabel = `Maßstäbliche Skizze: ${zeltLabel}-Zelt mit ${tische} ${tischWort} als Tafel und ${stuehle} ${stuhlWort}`;

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Zelt-Rahmen (zu Maßstab) */}
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
      {/* Zelt-Ecken (Beine/Gewichte) */}
      {[
        [tentX, tentY],
        [tentX + tentW, tentY],
        [tentX, tentY + tentH],
        [tentX + tentW, tentY + tentH],
      ].map(([cx, cy], i) => (
        <circle key={`corner-${i}`} cx={cx} cy={cy} r={4} fill="#d4af66" opacity={0.7} />
      ))}

      {/* Tafel: einzelne Tische nebeneinander (zu Maßstab) */}
      {Array.from({ length: nT }).map((_, i) => (
        <rect
          key={`tisch-${i}`}
          x={tafelX + i * TABLE_L}
          y={tafelY}
          width={TABLE_L}
          height={tafelH}
          rx={2}
          ry={2}
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={1.2}
        />
      ))}

      {/* Stühle */}
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
