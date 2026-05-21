/**
 * /angebot/[token] — Public-Token-basiertes Angebot
 *
 * Server-Side-Render: liest aus Baserow direkt mit DB-Token (server-only).
 * Token muss zu einer Angebot-Row matchen (Token_Public-Spalte).
 * Wenn Token ungueltig: 404.
 */
import { notFound } from "next/navigation";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";
import { parseSnapshot } from "@/lib/angebot-snapshot";
import AngebotView from "@/components/angebot/AngebotView";

type AngebotRow = {
  id: number;
  Angebot_ID: number;
  Angebotsnummer: string;
  Status: { value: string } | null;
  Anfragetext: string | null;
  Anfragedatum: string | null;
  Angebotsdatum: string | null;
  Gueltig_bis: string | null;
  Gesamtpreis: string | null;
  Token_Public: string;
  Akzeptiert_am: string | null;
  Snapshot_JSON: string | null;
  Snapshot_Version: string | null;
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
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution: string | null;
  Gesamt: string | null;
  Anzahlung_Soll_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Kaution_Soll_Eur: string | null;
  Lieferadresse: string | null;
  Notizen: string | null;
  Stripe_Anzahlung_Link: string | null;
  Stripe_Komplettzahlung_Link: string | null;
  Anzahlung_Bezahlt_am: string | null;
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

type ArtikelRow = {
  id: number;
  Bezeichnung: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadAngebot(token: string): Promise<{
  angebot: AngebotRow;
  buchung: BuchungRow;
  kunde: KundeRow;
  positionen: Array<{ id: number; bezeichnung: string; anzahl: number; einzelpreis: number; gesamt: number }>;
} | null> {
  const list = await listRows<AngebotRow>(TABLES.Angebote, { search: token, size: 5 });
  const angebot = list.results.find((a) => a.Token_Public === token);
  if (!angebot) return null;
  if (!angebot.Buchung_Link?.[0]?.id || !angebot.Kunde_Link?.[0]?.id) return null;

  const buchungId = angebot.Buchung_Link[0].id;
  const [buchung, kunde, positionenAll, artikelAll] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, angebot.Kunde_Link[0].id),
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    listRows<ArtikelRow>(TABLES.Artikel, { size: 200 }),
  ]);
  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  const positionen = positionenAll.results
    .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
    .map((p) => {
      const aid = p.Artikel_Link?.[0]?.id;
      return {
        id: p.id,
        bezeichnung: aid ? artikelNameById.get(aid) ?? `Artikel ${aid}` : "—",
        anzahl: parseInt(p.Anzahl, 10) || 1,
        einzelpreis: parseFloat(p.Einzelpreis_Eur) || 0,
        gesamt: parseFloat(p.Position_Gesamt_Eur) || 0,
      };
    });

  return { angebot, buchung, kunde, positionen };
}

export default async function AngebotPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadAngebot(token);
  if (!data) notFound();
  const { angebot, buchung, kunde, positionen } = data;

  // Snapshot bevorzugen: nach "Angebot freigeben" friert die Kundenansicht ein,
  // bis Manuel ein Update versendet. Live-Daten nur als Fallback bei Pre-Versand.
  const snapshot = parseSnapshot(angebot.Snapshot_JSON);
  const snapshotVersion = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
  const akzeptVersion = parseInt(angebot.Akzept_Version ?? "0", 10) || 0;
  const hasUpdateBanner = snapshotVersion > 0 && akzeptVersion > 0 && snapshotVersion > akzeptVersion;

  const anrede = snapshot
    ? `${snapshot.kunde.vorname} ${snapshot.kunde.nachname}`
    : `${kunde.Vorname} ${kunde.Nachname}`;
  const statusVal = angebot.Status?.value || "Offen";

  // Anzeige-Preise aus Snapshot (eingefroren) oder Live
  const preisArtikel = snapshot ? snapshot.preis_artikel.toString() : (buchung.Preis_Artikel ?? "0");
  const preisLieferung = snapshot ? snapshot.preis_lieferung.toString() : (buchung.Preis_Lieferung ?? "0");
  const preisAufbau = snapshot ? snapshot.preis_aufbau.toString() : (buchung.Preis_Aufbau ?? "0");
  const anzahlungSoll = snapshot ? snapshot.anzahlung_soll_eur.toString() : (buchung.Anzahlung_Soll_Eur ?? "0");
  const restzahlungSoll = snapshot ? snapshot.restzahlung_soll_eur.toString() : (buchung.Restzahlung_Soll_Eur ?? "0");
  const kautionSoll = snapshot ? snapshot.kaution_soll_eur.toString() : (buchung.Kaution_Soll_Eur ?? buchung.Kaution ?? "0");
  const eventVon = snapshot ? snapshot.event_datum_von : buchung.Event_datum_von;
  const eventBis = snapshot ? snapshot.event_datum_bis : buchung.Event_datum_bis;
  const displayPositions = snapshot
    ? snapshot.positionen.map((p, i) => ({
        id: i,
        bezeichnung: p.bezeichnung,
        anzahl: p.anzahl,
        einzelpreis: p.einzelpreis,
        gesamt: p.gesamt,
      }))
    : positionen;

  const hasPrices = parseFloat(preisArtikel) > 0;

  return (
    <AngebotView
      mode="customer"
      token={token}
      angebotsnummer={angebot.Angebotsnummer}
      anrede={anrede}
      statusVal={statusVal}
      snapshotVersion={snapshotVersion}
      hasUpdateBanner={hasUpdateBanner}
      eventVon={eventVon}
      eventBis={eventBis}
      hasPrices={hasPrices}
      displayPositions={displayPositions}
      preisArtikel={preisArtikel}
      preisLieferung={preisLieferung}
      preisAufbau={preisAufbau}
      anzahlungSoll={anzahlungSoll}
      restzahlungSoll={restzahlungSoll}
      kautionSoll={kautionSoll}
      akzeptiertAm={angebot.Akzeptiert_am}
      anzahlungBezahltAm={buchung.Anzahlung_Bezahlt_am}
      stripeAnzahlungLink={buchung.Stripe_Anzahlung_Link}
      stripeKomplettzahlungLink={buchung.Stripe_Komplettzahlung_Link}
      preisArtikelLive={buchung.Preis_Artikel ?? "0"}
      preisLieferungLive={buchung.Preis_Lieferung ?? "0"}
      preisAufbauLive={buchung.Preis_Aufbau ?? "0"}
      kundeForAccept={{
        Vorname: kunde.Vorname ?? "",
        Nachname: kunde.Nachname ?? "",
        Email: kunde.Email ?? "",
        Telefon: kunde.Telefon ?? "",
        Adresse_Strasse: kunde.Adresse_Strasse ?? "",
        Adresse_PLZ: kunde.Adresse_PLZ ?? "",
        Adresse_Ort: kunde.Adresse_Ort ?? "",
      }}
    />
  );
}
