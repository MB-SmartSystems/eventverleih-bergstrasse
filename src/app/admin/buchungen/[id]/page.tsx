/**
 * /admin/buchungen/[id] — Buchungs-Detail
 *
 * Zeigt alle Buchungsdetails + Positionen + Zahlungen + verknüpfte Rechnungen.
 * Aktion: Status updaten (siehe BuchungStatusPanel).
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";
import BuchungStatusPanel from "./BuchungStatusPanel";
import RechnungErstellenButton from "./RechnungErstellenButton";
import ZahlungsPanel from "./ZahlungsPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Status_Erweitert: { value: string } | null;
  Standort_Typ: { value: string } | null;
  Standort_Bestaetigt: boolean;
  Helfer_Bestaetigt: boolean;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution: string | null;
  Gesamt: string | null;
  Lieferadresse: string | null;
  Aufbau_gewuenscht: { value: string } | null;
  Abbau_gewuenscht: { value: string } | null;
  Notizen: string | null;
  Anzahlung_Soll_Eur: string | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Soll_Eur: string | null;
  Restzahlung_Bezahlt_am: string | null;
  Kaution_Soll_Eur: string | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_Eur: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Storno_am: string | null;
  Storno_Stufe: { value: string } | null;
  Storno_Betrag_Eur: string | null;
  Schaden_Betrag_Eur: string | null;
  Token_Angebot: string | null;
  Token_Vertrag: string | null;
  Buchung_Quelle: { value: string } | null;
  Kunde_Link: Array<{ id: number; value: string }>;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
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

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Typ_Erweitert: { value: string } | null;
  Status: { value: string } | null;
  Betrag_Gesamt: string | null;
  Rechnungsdatum: string | null;
  Buchung_Link: Array<{ id: number }>;
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("de-DE");
}

function fmtEur(v: string | null): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function BuchungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { id } = await params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) notFound();

  let buchung: BuchungRow;
  try {
    buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);
  } catch {
    notFound();
  }

  const kundeId = buchung.Kunde_Link?.[0]?.id;
  const kunde = kundeId ? await getRow<KundeRow>(TABLES.Kunden, kundeId).catch(() => null) : null;

  const [positionenAll, rechnungenAll, artikelAll] = await Promise.all([
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    listRows<RechnungRow>(TABLES.Rechnungen, { size: 200 }),
    listRows<{ id: number; Bezeichnung: string }>(TABLES.Artikel, { size: 200 }),
  ]);
  const positionen = positionenAll.results.filter((p) => p.Buchung_Link?.[0]?.id === buchungId);
  const rechnungen = rechnungenAll.results.filter((r) => r.Buchung_Link?.[0]?.id === buchungId);
  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));

  const status = buchung.Status_Erweitert?.value ?? "Anfrage";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin/buchungen" className="text-sm text-warm-muted hover:text-accent">
            ← Alle Buchungen
          </Link>
          <h1 className="text-2xl font-bold text-warm-text mt-2">
            Buchung #{buchung.Buchung_ID}
            <span className="ml-3 inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
              {status.replace(/_/g, " ")}
            </span>
          </h1>
          <p className="text-sm text-warm-muted mt-1">Event: {fmtDate(buchung.Event_datum_von)}</p>
        </div>
        <div className="flex gap-2">
          {buchung.Token_Angebot && (
            <a
              href={`https://eventverleih-bergstrasse.de/angebot/${buchung.Token_Angebot}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-2 rounded bg-warm-surface border border-warm-border hover:bg-accent-50"
            >
              🔗 Angebot
            </a>
          )}
          {buchung.Token_Vertrag && (
            <a
              href={`https://eventverleih-bergstrasse.de/vertrag/${buchung.Token_Vertrag}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-2 rounded bg-warm-surface border border-warm-border hover:bg-accent-50"
            >
              🔗 Vertrag
            </a>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Kunde */}
          {kunde && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Kunde</h2>
              <div className="text-sm space-y-1">
                <div className="text-warm-text font-medium">
                  <Link href={`/admin/kunden/${kunde.id}`} className="hover:text-accent">
                    {kunde.Vorname} {kunde.Nachname}
                  </Link>
                </div>
                {kunde.Email && (
                  <a href={`mailto:${kunde.Email}`} className="text-warm-muted hover:text-accent block">
                    {kunde.Email}
                  </a>
                )}
                {kunde.Telefon && (
                  <a href={`tel:${kunde.Telefon}`} className="text-warm-muted hover:text-accent block">
                    {kunde.Telefon}
                  </a>
                )}
                {kunde.Adresse_Strasse && (
                  <div className="text-warm-muted mt-2">
                    {kunde.Adresse_Strasse}, {kunde.Adresse_PLZ} {kunde.Adresse_Ort}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Artikel */}
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Artikel ({positionen.length})</h2>
            {positionen.length === 0 ? (
              <p className="text-sm text-warm-muted">Keine Artikel-Positionen.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-muted border-b border-warm-border">
                    <th className="py-2">Artikel</th>
                    <th className="text-right">Anzahl</th>
                    <th className="text-right">Einzel</th>
                    <th className="text-right">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map((p) => {
                    const aid = p.Artikel_Link?.[0]?.id;
                    const name = aid ? artikelNameById.get(aid) ?? `Artikel ${aid}` : "—";
                    return (
                    <tr key={p.id} className="border-b border-warm-border/50 last:border-0">
                      <td className="py-2 text-warm-text">{name}</td>
                      <td className="text-right text-warm-text">{p.Anzahl}</td>
                      <td className="text-right text-warm-muted">{fmtEur(p.Einzelpreis_Eur)}</td>
                      <td className="text-right text-warm-text font-medium">{fmtEur(p.Position_Gesamt_Eur)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* Notizen */}
          {buchung.Notizen && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Notizen</h2>
              <p className="text-sm text-warm-muted whitespace-pre-wrap">{buchung.Notizen}</p>
            </section>
          )}

          {/* Rechnungen */}
          {rechnungen.length > 0 && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Rechnungen ({rechnungen.length})</h2>
              <div className="space-y-2">
                {rechnungen.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/rechnungen/${r.id}`}
                    className="block p-3 rounded-lg border border-warm-border hover:bg-accent-50/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm">
                        <span className="font-mono text-warm-text">{r.Rechnungsnummer}</span>
                        {r.Typ_Erweitert?.value && (
                          <span className="ml-2 text-xs text-warm-muted">{r.Typ_Erweitert.value}</span>
                        )}
                      </div>
                      <div className="text-sm text-warm-text font-medium">{fmtEur(r.Betrag_Gesamt)}</div>
                      <span className="text-xs text-warm-muted">{r.Status?.value ?? "—"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Zahlungen */}
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Zahlungen</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 text-warm-muted">Mietsumme</td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Artikel)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-warm-muted">Anzahlung (30 %)</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(buchung.Anzahlung_Soll_Eur)}
                    {buchung.Anzahlung_Bezahlt_am && (
                      <span className="text-xs text-green-600 block">✓ {fmtDate(buchung.Anzahlung_Bezahlt_am)}</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-warm-muted">Restzahlung (70 %)</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(buchung.Restzahlung_Soll_Eur)}
                    {buchung.Restzahlung_Bezahlt_am && (
                      <span className="text-xs text-green-600 block">✓ {fmtDate(buchung.Restzahlung_Bezahlt_am)}</span>
                    )}
                  </td>
                </tr>
                <tr className="border-t border-warm-border">
                  <td className="py-1.5 text-warm-muted">Kaution</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(buchung.Kaution_Soll_Eur)}
                    {buchung.Kaution_Hinterlegt_am && (
                      <span className="text-xs text-blue-600 block">↘ {fmtDate(buchung.Kaution_Hinterlegt_am)}</span>
                    )}
                    {buchung.Kaution_Rueckzahlung_am && (
                      <span className="text-xs text-green-600 block">↗ {fmtDate(buchung.Kaution_Rueckzahlung_am)}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Zahlungseingang */}
          <ZahlungsPanel
            buchungId={buchung.id}
            anzahlungBezahlt={buchung.Anzahlung_Bezahlt_am}
            restzahlungBezahlt={buchung.Restzahlung_Bezahlt_am}
            kautionHinterlegt={buchung.Kaution_Hinterlegt_am}
          />

          {/* Status-Aktionen */}
          <BuchungStatusPanel buchungId={buchung.id} currentStatus={status} />

          {/* Rechnung erstellen */}
          <RechnungErstellenButton
            buchungId={buchung.id}
            hasPrice={parseFloat(buchung.Preis_Artikel ?? "0") > 0}
            alreadyHasRechnung={rechnungen.length > 0}
          />

          {/* Meta */}
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border text-xs space-y-1 text-warm-muted">
            <div>Quelle: {buchung.Buchung_Quelle?.value ?? "—"}</div>
            <div>Standort: {buchung.Standort_Typ?.value?.replace(/_/g, " ") ?? "—"}</div>
            {buchung.Aufbau_gewuenscht?.value === "Ja" && <div>✓ Aufbau gewünscht</div>}
            {buchung.Abbau_gewuenscht?.value === "Ja" && <div>✓ Abbau gewünscht</div>}
            {buchung.Lieferadresse && <div>Lieferung: {buchung.Lieferadresse}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
