/**
 * /rechnung/[token] — Public Web-Ansicht einer Rechnung
 *
 * Findet die Rechnung anhand des UUID-Tokens. Zeigt formatierte Rechnung
 * inkl. PDF-Download-Button. PDF wird vom n8n-Workflow nach Erstellung
 * in Vercel Blob gelegt und in Rechnungen.PDF_URL hinterlegt.
 */
import { notFound } from "next/navigation";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";
import { getSystemKonfig, configText } from "@/lib/system-konfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Rechnungsdatum: string | null;
  Typ_Erweitert: { value: string } | null;
  Status: { value: string } | null;
  Betrag_Netto: string | null;
  Betrag_Gesamt: string | null;
  USt_Satz: string | null;
  Bezahlt_am: string | null;
  PDF_URL: string | null;
  Token_Public: string;
  Buchung_Link: Array<{ id: number }>;
  Kunde_Link: Array<{ id: number }>;
};

type BuchungRow = {
  id: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution_Soll_Eur: string | null;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Firma: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};

type PositionRow = {
  id: number;
  Anzahl: string;
  Einzelpreis_Eur: string;
  Position_Gesamt_Eur: string;
  Artikel_Link: Array<{ id: number; value: string }>;
  Buchung_Link: Array<{ id: number }>;
};

function fmtEur(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

export default async function RechnungPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  // Suche Rechnung mit diesem Token (Volltextsuche auf Baserow Search-Param)
  const list = await listRows<RechnungRow>(TABLES.Rechnungen, { search: token, size: 50 });
  const rechnung = list.results.find((r) => r.Token_Public === token);
  if (!rechnung) notFound();

  const buchungId = rechnung.Buchung_Link?.[0]?.id;
  const kundeId = rechnung.Kunde_Link?.[0]?.id;
  if (!buchungId || !kundeId) notFound();

  const [buchung, kunde, positionenAll, config] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, kundeId),
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    getSystemKonfig(),
  ]);
  const positionen = positionenAll.results.filter((p) => p.Buchung_Link?.[0]?.id === buchungId);

  const summe = num(rechnung.Betrag_Gesamt);
  const kaution = num(buchung.Kaution_Soll_Eur);
  const zusatz = [
    { label: "Lieferpauschale", value: num(buchung.Preis_Lieferung) },
    { label: "Aufbau", value: num(buchung.Preis_Aufbau) },
    { label: "Abbau", value: num(buchung.Preis_Abbau) },
  ].filter((z) => z.value > 0);

  const ustHinweis = configText(config, "USt_Hinweis", "Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.");
  const firmenname = configText(config, "Firmenname", "Eventverleih Bergstraße");
  const inhaber = configText(config, "Inhaber", "Manuel Büttner");
  const anschrift = configText(config, "Anschrift", "Schlesierstraße 19a, 64665 Alsbach-Hähnlein");
  const telefon = configText(config, "Telefon", "+49 156 79521124");
  const email = configText(config, "Email", "info@eventverleih-bergstrasse.de");
  const iban = configText(config, "IBAN", "");
  const paypal = configText(config, "PayPal", "info@eventverleih-bergstrasse.de");
  const steuernummer = configText(config, "Steuernummer", "");

  return (
    <div className="min-h-screen bg-warm-bg py-8 px-4 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-10 border border-warm-border">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="text-lg font-bold text-warm-text">{firmenname}</div>
              <div className="text-sm text-warm-muted mt-1">
                {inhaber}
                <br />
                {anschrift}
                <br />
                {telefon} · {email}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-xs text-warm-muted uppercase tracking-wide">Rechnung</div>
              <div className="font-mono text-warm-text font-bold text-lg">{rechnung.Rechnungsnummer}</div>
              <div className="text-warm-muted mt-1">Datum: {fmtDate(rechnung.Rechnungsdatum)}</div>
              {rechnung.Status?.value === "Bezahlt" && (
                <div className="mt-2 inline-block px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-medium">
                  ✓ Bezahlt am {fmtDate(rechnung.Bezahlt_am)}
                </div>
              )}
            </div>
          </div>

          {/* Kunde */}
          <div className="mb-6">
            <div className="text-xs text-warm-muted uppercase tracking-wide mb-1">Rechnung an</div>
            <div className="text-warm-text">
              {kunde.Firma && (
                <>
                  <strong>{kunde.Firma}</strong>
                  <br />
                  z. Hd. {kunde.Vorname} {kunde.Nachname}
                </>
              )}
              {!kunde.Firma && (
                <>
                  {kunde.Vorname} {kunde.Nachname}
                </>
              )}
              {kunde.Adresse_Strasse && (
                <>
                  <br />
                  {kunde.Adresse_Strasse}
                  <br />
                  {kunde.Adresse_PLZ} {kunde.Adresse_Ort}
                </>
              )}
              {kunde.Telefon && (
                <>
                  <br />
                  Tel: {kunde.Telefon}
                </>
              )}
              {kunde.Email && (
                <>
                  <br />
                  {kunde.Email}
                </>
              )}
            </div>
          </div>

          {/* Leistungszeitraum */}
          {buchung.Event_datum_von && (
            <div className="text-sm text-warm-muted mb-4">
              Leistungszeitraum: {fmtDate(buchung.Event_datum_von)}
              {buchung.Event_datum_bis && buchung.Event_datum_bis !== buchung.Event_datum_von &&
                ` – ${fmtDate(buchung.Event_datum_bis)}`}
            </div>
          )}

          {/* Positionen */}
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="border-b-2 border-warm-border text-left text-xs uppercase tracking-wide text-warm-muted">
                <th className="py-2">Position</th>
                <th className="py-2 text-right w-16">Anzahl</th>
                <th className="py-2 text-right w-24">Einzel</th>
                <th className="py-2 text-right w-24">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {positionen.length === 0 ? (
                <tr>
                  <td className="py-3 text-warm-text">Vermietung gemäß Buchung</td>
                  <td className="py-3 text-right text-warm-text">1</td>
                  <td className="py-3 text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Artikel)}</td>
                  <td className="py-3 text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Artikel)}</td>
                </tr>
              ) : (
                positionen.map((p) => (
                  <tr key={p.id} className="border-b border-warm-border/50">
                    <td className="py-2 text-warm-text">{p.Artikel_Link?.[0]?.value || "—"}</td>
                    <td className="py-2 text-right text-warm-text">{p.Anzahl}</td>
                    <td className="py-2 text-right font-mono text-warm-text">{fmtEur(p.Einzelpreis_Eur)}</td>
                    <td className="py-2 text-right font-mono text-warm-text">{fmtEur(p.Position_Gesamt_Eur)}</td>
                  </tr>
                ))
              )}
              {zusatz.map((z) => (
                <tr key={z.label} className="border-b border-warm-border/50">
                  <td colSpan={3} className="py-2 text-warm-text">
                    {z.label}
                  </td>
                  <td className="py-2 text-right font-mono text-warm-text">{fmtEur(z.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summe */}
          <div className="mt-6 flex justify-end">
            <div className="w-full sm:w-1/2 text-sm">
              <div className="flex justify-between border-t-2 border-warm-text pt-3 mt-3 text-lg font-bold text-warm-text">
                <span>Gesamtbetrag</span>
                <span className="font-mono">{fmtEur(summe)}</span>
              </div>
              {kaution > 0 && (
                <div className="text-xs text-warm-muted italic mt-3">
                  Hinweis: Zusätzlich wird bei Übergabe eine Kaution von {fmtEur(kaution)} hinterlegt und nach
                  beanstandungsfreier Rückgabe vollständig erstattet.
                </div>
              )}
            </div>
          </div>

          {/* Zahlungsdaten */}
          {rechnung.Status?.value !== "Bezahlt" && (
            <div className="mt-8 p-4 rounded-lg bg-accent-50 border-l-4 border-accent">
              <div className="font-semibold text-warm-text mb-1">Zahlungsdetails</div>
              <div className="text-sm text-warm-muted">
                Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf folgendes Konto:
                <br />
                Kontoinhaber: {inhaber}
                <br />
                IBAN: <span className="font-mono text-warm-text">{iban}</span>
                <br />
                Alternativ per PayPal an: {paypal}
              </div>
            </div>
          )}

          {/* PDF Download */}
          <div className="mt-6 flex flex-wrap gap-3">
            {rechnung.PDF_URL ? (
              <a
                href={rechnung.PDF_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark"
              >
                📄 Rechnung als PDF herunterladen
              </a>
            ) : (
              <div className="text-xs text-warm-muted italic">
                PDF wird gerade erstellt … bitte in 1–2 Minuten neu laden.
              </div>
            )}
          </div>

          {/* USt-Hinweis + Steuernummer */}
          <div className="mt-6 text-xs text-warm-muted space-y-1">
            <div>{ustHinweis}</div>
            {steuernummer && <div>Steuernummer: {steuernummer}</div>}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-warm-muted">
          {firmenname} · {anschrift} · {telefon}
          {steuernummer && <> · Steuernummer {steuernummer}</>}
        </div>
      </div>
    </div>
  );
}
