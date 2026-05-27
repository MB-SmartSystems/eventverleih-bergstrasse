/**
 * HTML-Template fuer das Eventverleih-Bergstrasse ANGEBOT (helles Druck-Dokument).
 *
 * Pendant zu rechnung-html.ts — gleiche Optik. Wird ueber /angebot/[token]/print
 * ausgeliefert und vom n8n-Render-Flow (eve-pdf-render) via Gotenberg zu PDF
 * gerendert (In-Portal-Download). KEINE Zahlungs-/IBAN-Details — das Angebot wird
 * ueber den Bestaetigungs-Flow bezahlt, nicht per Ueberweisung auf das Dokument.
 */

export interface AngebotHtmlContext {
  angebotsnummer: string;
  angebotsdatum: string | null;
  gueltig_bis: string | null;
  leistung_von: string | null;
  leistung_bis: string | null;

  kunde: {
    vorname: string;
    nachname: string;
    firma?: string;
    adresse?: string;
    plz?: string;
    ort?: string;
    email?: string;
    telefon?: string;
  };

  positionen: Array<{
    bezeichnung: string;
    anzahl: number;
    einzelpreis_eur: number;
    gesamt_eur: number;
  }>;

  zusatz_positionen?: Array<{
    bezeichnung: string;
    betrag_eur: number;
  }>;

  mietsumme_eur: number;
  anzahlung_eur: number;
  restzahlung_eur: number;
  kaution_eur: number;

  firma: {
    name: string;
    inhaber: string;
    anschrift: string;
    telefon: string;
    email: string;
    website: string;
    ust_hinweis: string;
  };
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function escape(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAngebotHtml(ctx: AngebotHtmlContext): string {
  const k = ctx.kunde;
  const f = ctx.firma;

  const positionenRows = ctx.positionen
    .map(
      (p) => `
      <tr>
        <td>${escape(p.bezeichnung)}</td>
        <td class="num">${p.anzahl}</td>
        <td class="num">${fmt(p.einzelpreis_eur)} €</td>
        <td class="num">${fmt(p.gesamt_eur)} €</td>
      </tr>`,
    )
    .join("");

  const zusatzRows = (ctx.zusatz_positionen ?? [])
    .filter((z) => z.betrag_eur > 0)
    .map(
      (z) => `
      <tr>
        <td colspan="3">${escape(z.bezeichnung)}</td>
        <td class="num">${fmt(z.betrag_eur)} €</td>
      </tr>`,
    )
    .join("");

  const leistung =
    ctx.leistung_von && ctx.leistung_bis && ctx.leistung_von !== ctx.leistung_bis
      ? `${fmtDate(ctx.leistung_von)} – ${fmtDate(ctx.leistung_bis)}`
      : fmtDate(ctx.leistung_von);

  const kundenName = k.firma
    ? `${escape(k.firma)}<br>z. Hd. ${escape(k.vorname)} ${escape(k.nachname)}`
    : `${escape(k.vorname)} ${escape(k.nachname)}`;

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>Angebot ${escape(ctx.angebotsnummer)}</title>
<style>
@page { margin: 2cm; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #2a2a2a; margin: 0; }
.header { display: flex; justify-content: space-between; margin-bottom: 28px; }
.firma { font-size: 10pt; line-height: 1.5; }
.firma .name { font-size: 14pt; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
.meta { text-align: right; font-size: 10pt; }
.meta .row { margin-bottom: 4px; }
.meta strong { display: inline-block; min-width: 120px; }
.kunde { margin: 24px 0 28px; font-size: 11pt; line-height: 1.45; }
.kunde-label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
h1 { font-size: 18pt; margin: 8px 0 18px; color: #1a1a1a; }
.leistung { font-size: 10pt; color: #555; margin-bottom: 16px; }
table.positionen { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
table.positionen th { background: #f4f1ec; text-align: left; padding: 9px 10px; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.4px; color: #555; font-weight: 600; border-bottom: 2px solid #d9d2c5; }
table.positionen td { padding: 9px 10px; border-bottom: 1px solid #e9e4d9; }
table.positionen td.num, table.positionen th.num { text-align: right; white-space: nowrap; }
.summary { width: 55%; margin-left: auto; margin-top: 18px; font-size: 11pt; }
.summary .row { display: flex; justify-content: space-between; padding: 5px 0; }
.summary .sub { color: #555; font-size: 10pt; }
.summary .total { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-weight: 700; font-size: 13pt; }
.kaution-note { margin-top: 12px; font-size: 9.5pt; color: #666; font-style: italic; }
.hinweis { margin: 26px 0 18px; padding: 14px 16px; background: #f9f6f0; border-left: 3px solid #b89758; font-size: 10.5pt; }
.hinweis strong { display: block; margin-bottom: 4px; }
.ust { margin: 24px 0; font-size: 10pt; color: #555; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #ddd; font-size: 8.5pt; color: #777; display: flex; justify-content: space-between; }
</style></head><body>

<div class="header">
  <div class="firma">
    <div class="name">${escape(f.name)}</div>
    <div>${escape(f.inhaber)}</div>
    <div>${escape(f.anschrift)}</div>
    <div>${escape(f.telefon)} · ${escape(f.email)}</div>
  </div>
  <div class="meta">
    <div class="row"><strong>Angebotsnummer:</strong> ${escape(ctx.angebotsnummer)}</div>
    <div class="row"><strong>Angebotsdatum:</strong> ${fmtDate(ctx.angebotsdatum)}</div>
    <div class="row"><strong>Gültig bis:</strong> ${fmtDate(ctx.gueltig_bis)}</div>
  </div>
</div>

<div class="kunde">
  <div class="kunde-label">Angebot für</div>
  ${kundenName}
  ${k.adresse ? `<br>${escape(k.adresse)}` : ""}
  ${k.plz || k.ort ? `<br>${escape(k.plz ?? "")} ${escape(k.ort ?? "")}` : ""}
  ${k.telefon ? `<br>Tel: ${escape(k.telefon)}` : ""}
  ${k.email ? `<br>${escape(k.email)}` : ""}
</div>

<h1>Angebot</h1>
${leistung && leistung !== "—" ? `<div class="leistung">Mietzeitraum: ${leistung}</div>` : ""}

<table class="positionen">
  <thead>
    <tr>
      <th>Position</th>
      <th class="num">Anzahl</th>
      <th class="num">Einzelpreis</th>
      <th class="num">Gesamt</th>
    </tr>
  </thead>
  <tbody>
    ${positionenRows}
    ${zusatzRows}
  </tbody>
</table>

<div class="summary">
  <div class="row"><span>Mietsumme</span><span>${fmt(ctx.mietsumme_eur)} €</span></div>
  <div class="row sub"><span>Anzahlung bei Bestätigung (30 %)</span><span>${fmt(ctx.anzahlung_eur)} €</span></div>
  <div class="row sub"><span>Restzahlung bei Übergabe (70 %)</span><span>${fmt(ctx.restzahlung_eur)} €</span></div>
  <div class="row total"><span>Gesamt</span><span>${fmt(ctx.mietsumme_eur)} €</span></div>
  ${
    ctx.kaution_eur > 0
      ? `<div class="kaution-note">Zusätzlich wird bei Übergabe eine Kaution von ${fmt(ctx.kaution_eur)} € hinterlegt und nach beanstandungsfreier Rückgabe vollständig erstattet.</div>`
      : ""
  }
</div>

<div class="hinweis">
  <strong>So geht es weiter</strong>
  Sie können dieses Angebot online ansehen und mit einem Klick bestätigen — den Link finden Sie in Ihrer E-Mail bzw. in Ihrem Kundenbereich. Mit Eingang der Anzahlung ist Ihr Termin verbindlich reserviert.
</div>

<div class="ust">${escape(f.ust_hinweis)}</div>

<div class="footer">
  <div>
    ${escape(f.name)} · ${escape(f.inhaber)}<br>
    ${escape(f.anschrift)}
  </div>
  <div>
    ${escape(f.telefon)}<br>
    ${escape(f.email)} · ${escape(f.website)}
  </div>
</div>

</body></html>`;
}
