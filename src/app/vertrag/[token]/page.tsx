/**
 * /vertrag/[token] — Vollständiger Mietvertrag (Public, Token-basiert)
 *
 * Zeigt: Kunden-Daten, Buchungsdetails, alle Positionen, Mietvertrags-Klauseln (`MietvertragText`),
 * Notfall-Kontakt-Box, ggf. Akzeptanz-Stempel. Mit Print-CSS für Browser-PDF-Druck.
 */
import { notFound } from "next/navigation";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";
import { getSystemKonfig, configText } from "@/lib/system-konfig";
import MietvertragText from "@/components/MietvertragText";
import NotfallKontaktBox from "@/components/NotfallKontaktBox";
import PrintButton from "@/components/PrintButton";
import { parseSnapshot } from "@/lib/angebot-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AngebotRow = {
  id: number;
  Angebotsnummer: string;
  Status: { value: string } | null;
  Akzeptiert_am: string | null;
  Token_Public: string;
  Snapshot_JSON: string | null;
  Akzept_Snapshot_JSON: string | null;
  Akzept_Version: string | null;
  Buchung_Link: Array<{ id: number }>;
  Kunde_Link: Array<{ id: number }>;
};

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Anzahlung_Soll_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Kaution_Soll_Eur: string | null;
  Lieferadresse: string | null;
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
  Artikel_Link: Array<{ id: number }>;
  Buchung_Link: Array<{ id: number }>;
};

type ArtikelRow = { id: number; Bezeichnung: string };

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtEur(v: string | null): string {
  if (!v) return "0,00 €";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function VertragPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const angebotList = await listRows<AngebotRow>(TABLES.Angebote, { search: token, size: 5 });
  const angebot = angebotList.results.find((a) => a.Token_Public === token);
  if (!angebot) notFound();

  const buchungId = angebot.Buchung_Link?.[0]?.id;
  const kundeId = angebot.Kunde_Link?.[0]?.id;
  if (!buchungId || !kundeId) notFound();

  const [buchung, kunde, positionenAll, artikelAll, config] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, kundeId),
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    listRows<ArtikelRow>(TABLES.Artikel, { size: 200 }),
    getSystemKonfig(),
  ]);
  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  // Akzept-Snapshot bevorzugen (rechtsverbindlich), Fallback aktueller Snapshot, sonst Live
  const akzeptSnap = parseSnapshot(angebot.Akzept_Snapshot_JSON);
  const liveSnap = parseSnapshot(angebot.Snapshot_JSON);
  const snap = akzeptSnap ?? liveSnap;
  const livePositionen = positionenAll.results
    .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
    .map((p) => ({
      id: p.id,
      bezeichnung: p.Artikel_Link?.[0]?.id
        ? artikelNameById.get(p.Artikel_Link[0].id) ?? `Artikel ${p.Artikel_Link[0].id}`
        : "—",
      anzahl: parseInt(p.Anzahl, 10) || 1,
      einzelpreis: parseFloat(p.Einzelpreis_Eur) || 0,
      gesamt: parseFloat(p.Position_Gesamt_Eur) || 0,
    }));
  const positionen = snap
    ? snap.positionen.map((p, i) => ({
        id: i,
        bezeichnung: p.bezeichnung,
        anzahl: p.anzahl,
        einzelpreis: p.einzelpreis,
        gesamt: p.gesamt,
      }))
    : livePositionen;

  const displayEventVon = snap?.event_datum_von ?? buchung.Event_datum_von;
  const displayEventBis = snap?.event_datum_bis ?? buchung.Event_datum_bis;
  const displayPreisArtikel = snap ? String(snap.preis_artikel) : buchung.Preis_Artikel;
  const displayPreisLieferung = snap ? String(snap.preis_lieferung) : buchung.Preis_Lieferung;
  const displayPreisAbholung = snap ? String(snap.preis_abholung ?? 0) : buchung.Preis_Abholung;
  const displayPreisAufbau = snap ? String(snap.preis_aufbau) : buchung.Preis_Aufbau;
  const displayAnzahlungSoll = snap ? String(snap.anzahlung_soll_eur) : buchung.Anzahlung_Soll_Eur;
  const displayRestzahlungSoll = snap ? String(snap.restzahlung_soll_eur) : buchung.Restzahlung_Soll_Eur;
  const displayKautionSoll = snap ? String(snap.kaution_soll_eur) : buchung.Kaution_Soll_Eur;
  const displayLieferadresse = snap?.lieferadresse ?? buchung.Lieferadresse;
  const displayKunde = snap
    ? {
        Vorname: snap.kunde.vorname,
        Nachname: snap.kunde.nachname,
        Firma: snap.kunde.firma,
        Email: snap.kunde.email,
        Telefon: snap.kunde.telefon,
        Adresse_Strasse: snap.kunde.adresse_strasse,
        Adresse_PLZ: snap.kunde.adresse_plz,
        Adresse_Ort: snap.kunde.adresse_ort,
      }
    : kunde;

  const firmenname = configText(config, "Firmenname", "Eventverleih Bergstraße");
  const inhaber = configText(config, "Inhaber", "Manuel Büttner");
  const anschrift = configText(config, "Anschrift", "Schlesierstraße 19a, 64665 Alsbach-Hähnlein");
  const telefon = configText(config, "Telefon", "+49 156 79521124");
  const email = configText(config, "Email", "info@eventverleih-bergstrasse.de");
  const steuernummer = configText(config, "Steuernummer", "");

  const isAccepted = angebot.Status?.value === "Akzeptiert";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:py-12 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-10 border border-gray-300 print:shadow-none print:border-0 print:rounded-none">
          {/* Print-Hinweis (nur Bildschirm) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Mietvertrag</div>
              <h1 className="text-2xl font-bold text-gray-900">Vertrag {angebot.Angebotsnummer}</h1>
            </div>
            <PrintButton />
          </div>

          {/* Header (Firma + Kunde) */}
          <div className="flex flex-wrap justify-between gap-6 mb-8">
            <div className="text-sm">
              <div className="font-bold text-gray-900">{firmenname}</div>
              <div className="text-gray-500">
                {inhaber}
                <br />
                {anschrift}
                <br />
                {telefon} · {email}
                {steuernummer && (
                  <>
                    <br />
                    Steuernummer: {steuernummer}
                  </>
                )}
              </div>
            </div>
            <div className="text-sm text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mieter</div>
              <div className="text-gray-900">
                {displayKunde.Firma && (
                  <>
                    <strong>{displayKunde.Firma}</strong>
                    <br />
                    z. Hd. {displayKunde.Vorname} {displayKunde.Nachname}
                  </>
                )}
                {!kunde.Firma && (
                  <>
                    {displayKunde.Vorname} {displayKunde.Nachname}
                  </>
                )}
                {displayKunde.Adresse_Strasse && (
                  <>
                    <br />
                    {displayKunde.Adresse_Strasse}
                    <br />
                    {displayKunde.Adresse_PLZ} {displayKunde.Adresse_Ort}
                  </>
                )}
                {displayKunde.Telefon && (
                  <>
                    <br />
                    Tel: {displayKunde.Telefon}
                  </>
                )}
                {displayKunde.Email && (
                  <>
                    <br />
                    {displayKunde.Email}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Buchungsdaten */}
          <table className="w-full text-sm border-collapse mb-6">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="py-2 text-gray-500 w-40">Vertragsnummer</td>
                <td className="py-2 font-mono text-gray-900">{angebot.Angebotsnummer}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-2 text-gray-500">Buchungs-ID</td>
                <td className="py-2 font-mono text-gray-900">#{buchung.Buchung_ID}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-2 text-gray-500">Event-Datum</td>
                <td className="py-2 text-gray-900">
                  {fmtDate(displayEventVon)}
                  {displayEventBis && displayEventBis !== displayEventVon &&
                    ` – ${fmtDate(displayEventBis)}`}
                </td>
              </tr>
              {displayLieferadresse && (
                <tr className="border-b border-gray-300">
                  <td className="py-2 text-gray-500">Veranstaltungsort</td>
                  <td className="py-2 text-gray-900">{displayLieferadresse}</td>
                </tr>
              )}
              {isAccepted && angebot.Akzeptiert_am && (
                <tr className="border-b border-gray-300 bg-green-50">
                  <td className="py-2 text-gray-500">Akzeptiert am</td>
                  <td className="py-2 text-green-800 font-medium">{fmtDate(angebot.Akzeptiert_am)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Positionen */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Mietgegenstände</h2>
          {positionen.length === 0 ? (
            <p className="text-sm text-gray-500 mb-6">— Noch keine Artikel zugeordnet —</p>
          ) : (
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2">Position</th>
                  <th className="py-2 text-right w-20">Anzahl</th>
                  <th className="py-2 text-right w-28">Einzelpreis</th>
                  <th className="py-2 text-right w-28">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((p) => (
                  <tr key={p.id} className="border-b border-gray-300/60">
                    <td className="py-2 text-gray-900">{p.bezeichnung}</td>
                    <td className="py-2 text-right text-gray-900">{p.anzahl}</td>
                    <td className="py-2 text-right font-mono text-gray-900">{fmtEur(String(p.einzelpreis))}</td>
                    <td className="py-2 text-right font-mono text-gray-900">{fmtEur(String(p.gesamt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Zahlungen-Übersicht */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Zahlungs-Übersicht</h2>
          <table className="w-full text-sm border-collapse mb-6">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="py-2">Mietsumme</td>
                <td className="py-2 text-right font-mono">{fmtEur(displayPreisArtikel)}</td>
              </tr>
              {displayPreisLieferung && parseFloat(displayPreisLieferung) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="py-2">Lieferung</td>
                  <td className="py-2 text-right font-mono">{fmtEur(displayPreisLieferung)}</td>
                </tr>
              )}
              {displayPreisAbholung && parseFloat(displayPreisAbholung) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="py-2">Abholung</td>
                  <td className="py-2 text-right font-mono">{fmtEur(displayPreisAbholung)}</td>
                </tr>
              )}
              {displayPreisAufbau && parseFloat(displayPreisAufbau) > 0 && (
                <tr className="border-b border-gray-300">
                  <td className="py-2">Aufbau-Service</td>
                  <td className="py-2 text-right font-mono">{fmtEur(displayPreisAufbau)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-900 font-semibold">
                <td className="py-2">Gesamt</td>
                <td className="py-2 text-right font-mono">
                  {fmtEur(
                    (
                      (parseFloat(displayPreisArtikel || "0") || 0) +
                      (parseFloat(displayPreisLieferung || "0") || 0) +
                      (parseFloat(displayPreisAbholung || "0") || 0) +
                      (parseFloat(displayPreisAufbau || "0") || 0)
                    ).toFixed(2),
                  )}
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-2">Anzahlung bei Bestätigung (30 %)</td>
                <td className="py-2 text-right font-mono">{fmtEur(displayAnzahlungSoll)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-2">Restzahlung bei Übergabe (70 %)</td>
                <td className="py-2 text-right font-mono">{fmtEur(displayRestzahlungSoll)}</td>
              </tr>
              <tr>
                <td className="py-2">Kaution (wird nach beanstandungsfreier Rückgabe erstattet)</td>
                <td className="py-2 text-right font-mono">{fmtEur(displayKautionSoll)}</td>
              </tr>
            </tbody>
          </table>

          {/* Notfall-Kontakt-Box */}
          <NotfallKontaktBox telefon={telefon} />

          {/* Vertragsbedingungen */}
          <MietvertragText />

          {/* Akzeptanz-Stempel oder Hinweis */}
          {isAccepted ? (
            <div className="mt-8 p-4 rounded-lg bg-green-50 border-l-4 border-green-500 text-sm">
              <p className="font-semibold text-green-900">
                ✓ Dieser Mietvertrag wurde am {fmtDate(angebot.Akzeptiert_am)} elektronisch akzeptiert.
              </p>
              <p className="text-green-800 mt-1">
                Die Akzeptanz erfolgt nach § 126b BGB in Textform — eine händische Unterschrift ist nicht erforderlich.
              </p>
            </div>
          ) : (
            <div className="mt-8 p-4 rounded-lg bg-gray-50 border border-gray-300 text-sm text-gray-500 print:hidden">
              <p>
                Dieser Vertrag wird wirksam, sobald Sie auf der{" "}
                <a href={`/angebot/${token}`} className="underline text-accent">
                  Angebots-Seite
                </a>{" "}
                den Bestätigungs-Button klicken.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
            {firmenname} · {anschrift} · {telefon}
            {steuernummer && <> · Steuernummer {steuernummer}</>}
            <br />
            Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.
          </div>
        </div>
      </div>

      {/* Print-CSS: minimal, weil Tailwind die Klassen `print:` schon verarbeitet */}
      <style>{`
        @media print {
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
