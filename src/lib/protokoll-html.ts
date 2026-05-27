/**
 * Helles, druckfertiges A4-HTML fuer das Uebergabe-/Ruecknahme-Protokoll.
 * Dokumentiert den festgehaltenen Zustand (Checkliste, Fotos, Schaeden, Kaution)
 * fuer den Schadensfall. Admin-gated; Manuel druckt/speichert es via Strg+P.
 */
export interface ProtokollContext {
  buchungNr: string;
  kundeName: string;
  zeitraum: string;
  uebergabe: {
    datum: string;
    adresse: string;
    checkliste: Array<{ name: string; ok: boolean; notiz?: string }>;
    fotos: string[];
  } | null;
  ruecknahme: {
    datum: string;
    schaden: Array<{ beschreibung: string; betrag_eur: number }>;
    schadenBetrag: number;
    fotos: string[];
  } | null;
  kaution: { soll: number; hinterlegt: string | null; rueckzahlung: string | null };
  firma: { name: string; inhaber: string; anschrift: string; telefon: string; email: string };
  erstelltAm: string;
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function eur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function fotoBlock(fotos: string[]): string {
  if (!fotos.length) return `<p class="muted">Keine Fotos hinterlegt.</p>`;
  return `<div class="fotos">${fotos
    .map((u) => `<img src="${esc(u)}" alt="Foto" />`)
    .join("")}</div>`;
}

export function renderProtokollHtml(ctx: ProtokollContext): string {
  const u = ctx.uebergabe;
  const r = ctx.ruecknahme;

  const uebergabeSection = u
    ? `
    <h2>Übergabe</h2>
    <table class="meta">
      <tr><td>Datum</td><td>${esc(u.datum || "—")}</td></tr>
      <tr><td>Übergabeort</td><td>${esc(u.adresse || "—")}</td></tr>
    </table>
    ${
      u.checkliste.length
        ? `<table class="liste">
            <thead><tr><th>Artikel / Position</th><th class="c">Geprüft</th><th>Notiz</th></tr></thead>
            <tbody>${u.checkliste
              .map(
                (c) =>
                  `<tr><td>${esc(c.name)}</td><td class="c">${c.ok ? "✓" : "○"}</td><td>${esc(c.notiz || "")}</td></tr>`,
              )
              .join("")}</tbody>
          </table>`
        : `<p class="muted">Keine Checkliste erfasst.</p>`
    }
    <h3>Fotos bei Übergabe</h3>
    ${fotoBlock(u.fotos)}
  `
    : `<h2>Übergabe</h2><p class="muted">Noch keine Übergabe dokumentiert.</p>`;

  const ruecknahmeSection = r
    ? `
    <h2>Rücknahme</h2>
    <table class="meta">
      <tr><td>Datum</td><td>${esc(r.datum || "—")}</td></tr>
    </table>
    ${
      r.schaden.length
        ? `<table class="liste">
            <thead><tr><th>Schaden / Mangel</th><th class="r">Betrag</th></tr></thead>
            <tbody>${r.schaden
              .map(
                (s) =>
                  `<tr><td>${esc(s.beschreibung)}</td><td class="r">${eur(s.betrag_eur || 0)}</td></tr>`,
              )
              .join("")}
            <tr class="sum"><td>Summe Schäden</td><td class="r">${eur(r.schadenBetrag || 0)}</td></tr>
            </tbody>
          </table>`
        : `<p class="ok">Keine Schäden dokumentiert.</p>`
    }
    <h3>Fotos bei Rücknahme</h3>
    ${fotoBlock(r.fotos)}
  `
    : `<h2>Rücknahme</h2><p class="muted">Noch keine Rücknahme dokumentiert.</p>`;

  const kautionSection =
    ctx.kaution.soll > 0
      ? `<h2>Kaution</h2>
        <table class="meta">
          <tr><td>Kautionsbetrag</td><td>${eur(ctx.kaution.soll)}</td></tr>
          <tr><td>Hinterlegt am</td><td>${esc(ctx.kaution.hinterlegt || "—")}</td></tr>
          <tr><td>Zurückerstattet am</td><td>${esc(ctx.kaution.rueckzahlung || "—")}</td></tr>
        </table>`
      : "";

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />
<title>Übergabeprotokoll Buchung ${esc(ctx.buchungNr)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px 40px; font-size: 13px; line-height: 1.5; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b8860b; padding-bottom: 12px; margin-bottom: 20px; }
  .head .firma { font-size: 15px; font-weight: 700; }
  .head .firma span { display: block; font-weight: 400; font-size: 11px; color: #555; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 14px 0 6px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  table.meta td { padding: 3px 6px; }
  table.meta td:first-child { color: #555; width: 180px; }
  table.liste th, table.liste td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
  table.liste th { background: #f5f5f5; font-size: 11px; }
  .c { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  tr.sum td { font-weight: 700; background: #faf6ec; }
  .muted { color: #888; font-style: italic; }
  .ok { color: #157347; }
  .fotos { display: flex; flex-wrap: wrap; gap: 8px; }
  .fotos img { width: 150px; height: 110px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; }
  .sign { display: flex; gap: 40px; margin-top: 48px; }
  .sign div { flex: 1; border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #555; }
  .foot { margin-top: 32px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
  @page { size: A4; margin: 16mm; }
</style></head>
<body>
  <div class="head">
    <div>
      <h1>Übergabe- / Rücknahmeprotokoll</h1>
      <div>Buchung ${esc(ctx.buchungNr)} · ${esc(ctx.kundeName)}</div>
      <div class="muted">Mietzeitraum: ${esc(ctx.zeitraum)}</div>
    </div>
    <div class="firma">${esc(ctx.firma.name)}
      <span>${esc(ctx.firma.inhaber)}</span>
      <span>${esc(ctx.firma.anschrift)}</span>
      <span>${esc(ctx.firma.telefon)}</span>
    </div>
  </div>

  ${uebergabeSection}
  ${ruecknahmeSection}
  ${kautionSection}

  <div class="sign">
    <div>Ort, Datum · Unterschrift Vermieter</div>
    <div>Ort, Datum · Unterschrift Mieter</div>
  </div>

  <div class="foot">
    Erstellt am ${esc(ctx.erstelltAm)} · ${esc(ctx.firma.name)} · ${esc(ctx.firma.email)}
  </div>
</body></html>`;
}
