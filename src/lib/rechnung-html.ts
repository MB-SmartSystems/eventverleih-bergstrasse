/**
 * HTML-Template für Eventverleih-Bergstrasse Rechnung.
 *
 * Wird vom n8n-Workflow eve-rechnung-pdf-mail an Gotenberg geschickt.
 * Im Backend nur für die Web-Vorschau / Public-Page genutzt.
 */

export interface RechnungContext {
  rechnungsnummer: string;
  rechnungsdatum: string; // ISO YYYY-MM-DD
  faelligkeit: string; // ISO YYYY-MM-DD
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

  summe_eur: number;
  kaution_eur: number;

  firma: {
    name: string;
    inhaber: string;
    anschrift: string;
    telefon: string;
    email: string;
    website: string;
    iban: string;
    paypal: string;
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

export function renderRechnungHtml(ctx: RechnungContext): string {
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
      </tr>`
    )
    .join("");

  const zusatzRows = (ctx.zusatz_positionen ?? [])
    .filter((z) => z.betrag_eur > 0)
    .map(
      (z) => `
      <tr>
        <td colspan="3">${escape(z.bezeichnung)}</td>
        <td class="num">${fmt(z.betrag_eur)} €</td>
      </tr>`
    )
    .join("");

  const leistung =
    ctx.leistung_von && ctx.leistung_bis && ctx.leistung_von !== ctx.leistung_bis
      ? `${fmtDate(ctx.leistung_von)} – ${fmtDate(ctx.leistung_bis)}`
      : fmtDate(ctx.leistung_von);

  const kundenName = k.firma ? `${escape(k.firma)}<br>z. Hd. ${escape(k.vorname)} ${escape(k.nachname)}` : `${escape(k.vorname)} ${escape(k.nachname)}`;

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>Rechnung ${escape(ctx.rechnungsnummer)}</title>
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
.summary { width: 50%; margin-left: auto; margin-top: 18px; font-size: 11pt; }
.summary .row { display: flex; justify-content: space-between; padding: 5px 0; }
.summary .total { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-weight: 700; font-size: 13pt; }
.kaution-note { margin-top: 12px; font-size: 9.5pt; color: #666; font-style: italic; }
.zahlungshinweis { margin: 26px 0 18px; padding: 14px 16px; background: #f9f6f0; border-left: 3px solid #b89758; font-size: 10.5pt; }
.zahlungshinweis strong { display: block; margin-bottom: 4px; }
.zahlungshinweis .iban { font-family: 'Courier New', monospace; letter-spacing: 0.5px; }
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
    <div class="row"><strong>Rechnungsnummer:</strong> ${escape(ctx.rechnungsnummer)}</div>
    <div class="row"><strong>Rechnungsdatum:</strong> ${fmtDate(ctx.rechnungsdatum)}</div>
    <div class="row"><strong>Fällig bis:</strong> ${fmtDate(ctx.faelligkeit)}</div>
  </div>
</div>

<div class="kunde">
  <div class="kunde-label">Rechnung an</div>
  ${kundenName}
  ${k.adresse ? `<br>${escape(k.adresse)}` : ""}
  ${k.plz || k.ort ? `<br>${escape(k.plz ?? "")} ${escape(k.ort ?? "")}` : ""}
</div>

<h1>Rechnung</h1>
${leistung && leistung !== "—" ? `<div class="leistung">Leistungszeitraum: ${leistung}</div>` : ""}

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
  <div class="row total"><span>Gesamtbetrag</span><span>${fmt(ctx.summe_eur)} €</span></div>
  ${
    ctx.kaution_eur > 0
      ? `<div class="kaution-note">Hinweis: Zusätzlich wird bei Übergabe eine Kaution von ${fmt(ctx.kaution_eur)} € hinterlegt und nach beanstandungsfreier Rückgabe vollständig erstattet.</div>`
      : ""
  }
</div>

<div class="zahlungshinweis">
  <strong>Zahlungsdetails</strong>
  Bitte überweisen Sie den Betrag bis spätestens ${fmtDate(ctx.faelligkeit)} auf folgendes Konto:<br>
  Kontoinhaber: ${escape(f.inhaber)}<br>
  IBAN: <span class="iban">${escape(f.iban)}</span><br>
  Alternativ per PayPal an: ${escape(f.paypal)}
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
