/**
 * /admin/anfragen/[id] — Detail einer Anfrage mit 4 Action-Buttons
 *
 * id = Angebote.id (Baserow row id)
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getRow, listRows, listAllRows, TABLES } from "@/lib/baserow/client";
import ActionPanel from "./ActionPanel";
import PositionsEditor, { type PositionItem, type ArtikelOption } from "./PositionsEditor";
import ServicesEditor from "./ServicesEditor";
import EventDatumEditor from "./EventDatumEditor";
import UpdateVersandPanel from "./UpdateVersandPanel";
import { parseSnapshot, diffAgainstLive } from "@/lib/angebot-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AngebotRow = {
  id: number;
  Angebot_ID: number;
  Angebotsnummer: string;
  Status: { value: string } | null;
  Anfragetext: string | null;
  Anfragedatum: string | null;
  Angebotsdatum: string | null;
  Gesamtpreis: string | null;
  Token_Public: string;
  Akzeptiert_am: string | null;
  Abgelehnt_am: string | null;
  Abgelehnt_Grund: string | null;
  Snapshot_JSON: string | null;
  Snapshot_Version: string | null;
  Snapshot_Erstellt_am: string | null;
  Akzept_Version: string | null;
  Buchung_Link: Array<{ id: number; value: string }>;
  Kunde_Link: Array<{ id: number; value: string }>;
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
  Notizen: string | null;
};

type KundeRow = {
  id: number;
  Kunde_ID: number;
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
  Aufbau_Pauschale_Snapshot_Eur: string | null;
  Artikel_Link: Array<{ id: number; value: string }>;
};

type ArtikelRow = {
  id: number;
  Bezeichnung: string;
  Mietpreis_WE_Eur: string | null;
  Aufbau_Pauschale_Eur: string | null;
  Kategorie: { value: string } | null;
  Sichtbar_Public: boolean;
};

function fmtEur(v: string | null | undefined): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function AnfrageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");

  const { id } = await params;
  const angebotId = parseInt(id, 10);
  if (!angebotId) notFound();

  let angebot: AngebotRow;
  try {
    angebot = await getRow<AngebotRow>(TABLES.Angebote, angebotId);
  } catch {
    notFound();
  }

  const buchungId = angebot.Buchung_Link?.[0]?.id;
  const kundeId = angebot.Kunde_Link?.[0]?.id;
  if (!buchungId || !kundeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Anfrage unvollständig</h1>
        <p className="text-gray-400">Diese Anfrage hat keine zugeordnete Buchung oder Kunden — bitte in Baserow prüfen.</p>
      </div>
    );
  }

  const [buchung, kunde] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, kundeId),
  ]);

  // Positionen + Artikel-Stamm (für Bezeichnung-Lookup + Editor-Picker)
  const [allPositionen, artikelAll] = await Promise.all([
    listRows<PositionRow & { Buchung_Link: Array<{ id: number }> }>(TABLES.Buchungs_Position, { size: 200 }),
    listAllRows<ArtikelRow>(TABLES.Artikel),
  ]);
  const positionen = allPositionen.results.filter((p) => p.Buchung_Link?.[0]?.id === buchungId);
  const artikelById = new Map(artikelAll.results.map((a) => [a.id, a]));

  const positionItems: PositionItem[] = positionen.map((p) => {
    const artikelId = p.Artikel_Link?.[0]?.id ?? 0;
    const art = artikelById.get(artikelId);
    return {
      id: p.id,
      artikelId,
      bezeichnung: art?.Bezeichnung ?? `Artikel ${artikelId}`,
      anzahl: parseInt(p.Anzahl, 10) || 1,
      einzelpreis: parseFloat(p.Einzelpreis_Eur) || 0,
    };
  });

  const artikelOptions: ArtikelOption[] = artikelAll.results
    .filter((a) => a.Sichtbar_Public !== false)
    .map((a) => ({
      id: a.id,
      bezeichnung: a.Bezeichnung,
      preis: parseFloat(a.Mietpreis_WE_Eur ?? "0") || 0,
      kategorie: a.Kategorie?.value ?? "—",
    }))
    .sort((a, b) => a.kategorie.localeCompare(b.kategorie) || a.bezeichnung.localeCompare(b.bezeichnung));

  const status = angebot.Status?.value || "Offen";
  const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${angebot.Token_Public}`;

  // ServicesEditor-Daten vorbereiten
  // Aufbau-Summe = Summe(Anzahl × Aufbau_Pauschale aus Artikel-Stamm) — egal ob Aufbau bisher gebucht
  let aufbauSummeEur = 0;
  for (const p of positionen) {
    const artikelId = p.Artikel_Link?.[0]?.id ?? 0;
    const art = artikelById.get(artikelId);
    const aufbauProStueck = parseFloat(art?.Aufbau_Pauschale_Eur ?? "0") || 0;
    aufbauSummeEur += (parseInt(p.Anzahl, 10) || 0) * aufbauProStueck;
  }

  // Service-Flags aus Notizen parsen (letzter "--- Service-Update YYYY-MM-DD ---"-Block)
  // Fallback: aus Preis-Feldern raten
  let initialLieferung = false;
  let initialAbholung = false;
  let initialAufbau = false;
  const notizen = buchung.Notizen || "";
  const lastBlock = notizen.split(/--- (?:Service-Update|Nachtraeglich gesetzt am) /).pop() || "";
  if (lastBlock !== notizen) {
    initialLieferung = /Lieferung gewuenscht/.test(lastBlock);
    initialAbholung = /Abholung gewuenscht/.test(lastBlock);
    initialAufbau = /Aufbau-Service/.test(lastBlock);
  } else {
    // Kein Service-Update-Block → aus Preis-Feldern. Legacy-Buchungen (vor Storage-Split
    // 2026-05-22) speicherten Hin+Rueck kombiniert in Preis_Lieferung mit Preis_Abholung=0.
    // Bei dieser Ambiguität: beide aktiv defaulten, sonst kann ein versehentlicher Save
    // die Abholung silent abschalten und das Halbieren-Resultat ueberschreiben.
    const lief = parseFloat(buchung.Preis_Lieferung ?? "0");
    const abh = parseFloat(buchung.Preis_Abholung ?? "0");
    if (lief > 0 && abh === 0) {
      // Legacy-Ambiguität → beide aktiv
      initialLieferung = true;
      initialAbholung = true;
    } else {
      if (lief > 0) initialLieferung = true;
      if (abh > 0) initialAbholung = true;
    }
    if (parseFloat(buchung.Preis_Aufbau ?? "0") > 0) initialAufbau = true;
  }

  // Adress-Display: Buchung.Lieferadresse hat Vorrang, Fallback Kunde
  let adresseDisplay: string | null = buchung.Lieferadresse;
  if (!adresseDisplay && kunde.Adresse_Strasse && kunde.Adresse_PLZ) {
    adresseDisplay = `${kunde.Adresse_Strasse}, ${kunde.Adresse_PLZ} ${kunde.Adresse_Ort ?? ""}`.trim();
  }

  // Snapshot-Diff: was hat sich seit letztem Versand geändert?
  const snapshot = parseSnapshot(angebot.Snapshot_JSON);
  const snapshotVersion = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
  const akzeptVersion = parseInt(angebot.Akzept_Version ?? "0", 10) || 0;
  const diffs = snapshot
    ? await diffAgainstLive(
        snapshot,
        {
          Event_datum_von: buchung.Event_datum_von,
          Event_datum_bis: buchung.Event_datum_bis,
          Preis_Artikel: buchung.Preis_Artikel,
          Preis_Lieferung: buchung.Preis_Lieferung,
          Preis_Abholung: buchung.Preis_Abholung,
          Preis_Aufbau: buchung.Preis_Aufbau,
          Preis_Abbau: buchung.Preis_Abbau,
          Anzahlung_Soll_Eur: buchung.Anzahlung_Soll_Eur,
          Restzahlung_Soll_Eur: buchung.Restzahlung_Soll_Eur,
          Kaution_Soll_Eur: buchung.Kaution_Soll_Eur,
          Lieferadresse: buchung.Lieferadresse,
        },
        buchungId,
        {
          Vorname: kunde.Vorname,
          Nachname: kunde.Nachname,
          Firma: kunde.Firma,
          Email: kunde.Email,
          Telefon: kunde.Telefon,
          Adresse_Strasse: kunde.Adresse_Strasse,
          Adresse_PLZ: kunde.Adresse_PLZ,
          Adresse_Ort: kunde.Adresse_Ort,
        }
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/anfragen" className="text-sm text-gray-400 hover:text-gold-400">
            ← Alle Anfragen
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">
            {angebot.Angebotsnummer}
            <span
              className={
                "ml-3 text-xs font-medium px-2 py-1 rounded " +
                (status === "Offen"
                  ? "bg-blue-500/20 text-blue-300"
                  : status === "Versendet"
                  ? "bg-yellow-500/20 text-yellow-300"
                  : status === "Akzeptiert"
                  ? "bg-green-500/20 text-green-300"
                  : status === "Abgelehnt"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-gray-500/20 text-gray-300")
              }
            >
              {status}
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Angefragt am {angebot.Anfragedatum || "—"}</p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
        >
          🔗 Kunden-Ansicht öffnen
        </a>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Versand-Status + Update-Versand */}
          <UpdateVersandPanel
            angebotId={angebot.id}
            snapshotVersion={snapshotVersion}
            snapshotErstelltAm={angebot.Snapshot_Erstellt_am}
            akzeptVersion={akzeptVersion}
            diffs={diffs}
          />

          {/* Mietzeitraum (Event-Datum) */}
          <EventDatumEditor
            buchungId={buchungId}
            initialVon={buchung.Event_datum_von}
            initialBis={buchung.Event_datum_bis}
          />

          {/* Kunde */}
          <section className="p-5 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-3">Kunde</h2>
            <div className="space-y-1 text-sm">
              <div className="text-white font-medium">
                {kunde.Vorname} {kunde.Nachname}
              </div>
              {kunde.Email && (
                <div className="text-gray-400">
                  <a href={`mailto:${kunde.Email}`} className="hover:text-gold-400">
                    {kunde.Email}
                  </a>
                </div>
              )}
              {kunde.Telefon && (
                <div className="text-gray-400">
                  <a href={`tel:${kunde.Telefon}`} className="hover:text-gold-400">
                    {kunde.Telefon}
                  </a>
                </div>
              )}
              {kunde.Adresse_Strasse && (
                <div className="text-gray-400 mt-2">
                  {kunde.Adresse_Strasse}, {kunde.Adresse_PLZ} {kunde.Adresse_Ort}
                </div>
              )}
            </div>
          </section>

          {/* Anfrage-Text */}
          {angebot.Anfragetext && (
            <section className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Anfrage-Text</h2>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{angebot.Anfragetext}</p>
            </section>
          )}

          {/* Positionen — editierbar */}
          <PositionsEditor buchungId={buchungId} initialPositionen={positionItems} artikelOptions={artikelOptions} />

          {/* Zusatzleistungen: Lieferung / Abholung / Aufbau — Auto-Save bei Toggle */}
          <ServicesEditor
            buchungId={buchungId}
            initialLieferung={initialLieferung}
            initialAbholung={initialAbholung}
            initialAufbau={initialAufbau}
            adresseDisplay={adresseDisplay}
            aufbauSummeEur={aufbauSummeEur}
          />

          {/* Notizen */}
          {buchung.Notizen && (
            <section className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Notizen</h2>
              <p className="text-sm text-gray-400 whitespace-pre-wrap">{buchung.Notizen}</p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Preise */}
          <section className="p-5 rounded-xl bg-gold-500/5 border border-gold-500/20">
            <h2 className="text-lg font-semibold text-white mb-3">Preise</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-400">Mietsumme (Artikel)</td>
                  <td className="text-right font-mono text-white">{fmtEur(buchung.Preis_Artikel)}</td>
                </tr>
                {(parseFloat(buchung.Preis_Lieferung || "0") || 0) > 0 && (
                  <tr>
                    <td className="py-1 text-gray-400">Lieferung</td>
                    <td className="text-right font-mono text-white">{fmtEur(buchung.Preis_Lieferung)}</td>
                  </tr>
                )}
                {(parseFloat(buchung.Preis_Abholung || "0") || 0) > 0 && (
                  <tr>
                    <td className="py-1 text-gray-400">Abholung</td>
                    <td className="text-right font-mono text-white">{fmtEur(buchung.Preis_Abholung)}</td>
                  </tr>
                )}
                {(parseFloat(buchung.Preis_Aufbau || "0") || 0) > 0 && (
                  <tr>
                    <td className="py-1 text-gray-400">Aufbau</td>
                    <td className="text-right font-mono text-white">{fmtEur(buchung.Preis_Aufbau)}</td>
                  </tr>
                )}
                <tr className="border-t border-white/10 font-semibold">
                  <td className="py-1 text-white">Gesamt</td>
                  <td className="text-right font-mono text-white">
                    {fmtEur(
                      (
                        (parseFloat(buchung.Preis_Artikel || "0") || 0) +
                        (parseFloat(buchung.Preis_Lieferung || "0") || 0) +
                        (parseFloat(buchung.Preis_Abholung || "0") || 0) +
                        (parseFloat(buchung.Preis_Aufbau || "0") || 0)
                      ).toFixed(2),
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-400">Anzahlung 30 %</td>
                  <td className="text-right font-mono text-gold-300">{fmtEur(buchung.Anzahlung_Soll_Eur)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-400">Restzahlung 70 %</td>
                  <td className="text-right font-mono text-gray-300">{fmtEur(buchung.Restzahlung_Soll_Eur)}</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-1 text-gray-400">Kaution</td>
                  <td className="text-right font-mono text-gray-300">{fmtEur(buchung.Kaution_Soll_Eur)}</td>
                </tr>
              </tbody>
            </table>
            {!buchung.Preis_Artikel && (
              <p className="text-xs text-yellow-400 mt-3">
                ⚠ Preise fehlen — in Baserow ergänzen bevor du freigibst, sonst sieht Kunde nichts.
              </p>
            )}
          </section>

          {/* Aktionen */}
          {status === "Offen" ? (
            <ActionPanel angebotId={angebot.id} hasPrices={!!buchung.Preis_Artikel && parseFloat(buchung.Preis_Artikel) > 0} />
          ) : (
            <section className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-3">Status</h2>
              {status === "Versendet" && (
                <p className="text-sm text-yellow-300">Angebot ist beim Kunden — er kann auf der Public-Seite akzeptieren.</p>
              )}
              {status === "Akzeptiert" && (
                <p className="text-sm text-green-300">
                  ✓ Kunde hat akzeptiert am {angebot.Akzeptiert_am?.slice(0, 10) || "?"}
                </p>
              )}
              {status === "Abgelehnt" && (
                <div className="text-sm text-red-300">
                  <p>✗ Abgelehnt am {angebot.Abgelehnt_am?.slice(0, 10) || "?"}</p>
                  {angebot.Abgelehnt_Grund && <p className="text-xs text-gray-400 mt-2">{angebot.Abgelehnt_Grund}</p>}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
