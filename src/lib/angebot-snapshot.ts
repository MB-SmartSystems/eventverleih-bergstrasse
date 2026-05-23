/**
 * Snapshot-Builder + Parser für Angebote.
 *
 * Bei "Angebot freigeben" wird der aktuelle Stand der Buchung + Kunde + Positionen
 * als JSON-String in Angebote.Snapshot_JSON eingefroren. Die Public-Pages
 * /angebot/[token] und /vertrag/[token] rendern aus diesem Snapshot, nicht aus
 * Live-Daten. Manuel kann im Dashboard die Buchung weiter editieren, ohne dass
 * der Kunde davon etwas sieht — bis er aktiv eine neue Version versendet.
 */
import { listRows, TABLES } from "@/lib/baserow/client";

export interface SnapshotKunde {
  vorname: string;
  nachname: string;
  firma: string;
  email: string;
  telefon: string;
  adresse_strasse: string;
  adresse_plz: string;
  adresse_ort: string;
}

export interface SnapshotPosition {
  artikel_id: number;
  bezeichnung: string;
  anzahl: number;
  einzelpreis: number;
  gesamt: number;
}

export interface AngebotSnapshot {
  version: number;
  erstellt_am: string;
  kunde: SnapshotKunde;
  event_datum_von: string | null;
  event_datum_bis: string | null;
  positionen: SnapshotPosition[];
  preis_artikel: number;
  preis_lieferung: number;
  preis_abholung: number;
  preis_aufbau: number;
  preis_abbau: number;
  anzahlung_soll_eur: number;
  restzahlung_soll_eur: number;
  kaution_soll_eur: number;
  lieferadresse: string | null;
}

type BuchungLite = {
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

type KundeLite = {
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

type ArtikelLite = { id: number; Bezeichnung: string };

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

/**
 * Holt Positionen aus Buchungs_Position + Artikel-Bezeichnungen, baut SnapshotPosition-Array.
 */
async function fetchPositionen(buchungId: number): Promise<SnapshotPosition[]> {
  const [positionenAll, artikelAll] = await Promise.all([
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    listRows<ArtikelLite>(TABLES.Artikel, { size: 200 }),
  ]);
  const artikelById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  return positionenAll.results
    .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
    .map((p) => {
      const aid = p.Artikel_Link?.[0]?.id ?? 0;
      return {
        artikel_id: aid,
        bezeichnung: artikelById.get(aid) ?? `Artikel ${aid}`,
        anzahl: parseInt(p.Anzahl, 10) || 1,
        einzelpreis: num(p.Einzelpreis_Eur),
        gesamt: num(p.Position_Gesamt_Eur),
      };
    });
}

/**
 * Baut Snapshot aus Live-Daten (Buchung + Kunde + Positionen aus Baserow).
 * Frische Read-Calls — keine Caches, damit der Snapshot exakt den Stand zum
 * Versand-Zeitpunkt fixiert.
 */
export async function buildSnapshot(opts: {
  version: number;
  buchung: BuchungLite;
  buchungId: number;
  kunde: KundeLite;
}): Promise<AngebotSnapshot> {
  const positionen = await fetchPositionen(opts.buchungId);
  return {
    version: opts.version,
    erstellt_am: new Date().toISOString(),
    kunde: {
      vorname: opts.kunde.Vorname ?? "",
      nachname: opts.kunde.Nachname ?? "",
      firma: opts.kunde.Firma ?? "",
      email: opts.kunde.Email ?? "",
      telefon: opts.kunde.Telefon ?? "",
      adresse_strasse: opts.kunde.Adresse_Strasse ?? "",
      adresse_plz: opts.kunde.Adresse_PLZ ?? "",
      adresse_ort: opts.kunde.Adresse_Ort ?? "",
    },
    event_datum_von: opts.buchung.Event_datum_von,
    event_datum_bis: opts.buchung.Event_datum_bis,
    positionen,
    preis_artikel: num(opts.buchung.Preis_Artikel),
    preis_lieferung: num(opts.buchung.Preis_Lieferung),
    preis_abholung: num(opts.buchung.Preis_Abholung),
    preis_aufbau: num(opts.buchung.Preis_Aufbau),
    preis_abbau: num(opts.buchung.Preis_Abbau),
    anzahlung_soll_eur: num(opts.buchung.Anzahlung_Soll_Eur),
    restzahlung_soll_eur: num(opts.buchung.Restzahlung_Soll_Eur),
    kaution_soll_eur: num(opts.buchung.Kaution_Soll_Eur),
    lieferadresse: opts.buchung.Lieferadresse,
  };
}

/**
 * Parses Snapshot_JSON-Spalte. Gibt null bei leerem oder fehlerhaftem Input.
 */
export function parseSnapshot(raw: string | null | undefined): AngebotSnapshot | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.positionen)) return null;
    return parsed as AngebotSnapshot;
  } catch {
    return null;
  }
}

/**
 * Diff-Check: Vergleicht Live-Buchung mit gespeichertem Snapshot.
 * Liefert lesbare Diff-Strings für Dashboard-Anzeige.
 * Leeres Array = kein Drift.
 */
export async function diffAgainstLive(
  snapshot: AngebotSnapshot,
  liveBuchung: BuchungLite,
  liveBuchungId: number,
  liveKunde: KundeLite
): Promise<string[]> {
  const diffs: string[] = [];
  const fmtD = (d: string | null) => (d ? d.slice(0, 10) : "—");

  if (snapshot.event_datum_von !== liveBuchung.Event_datum_von) {
    diffs.push(`Mietbeginn: ${fmtD(snapshot.event_datum_von)} → ${fmtD(liveBuchung.Event_datum_von)}`);
  }
  if (snapshot.event_datum_bis !== liveBuchung.Event_datum_bis) {
    diffs.push(`Mietende: ${fmtD(snapshot.event_datum_bis)} → ${fmtD(liveBuchung.Event_datum_bis)}`);
  }
  if (Math.abs(snapshot.preis_artikel - num(liveBuchung.Preis_Artikel)) > 0.005) {
    diffs.push(`Mietsumme: ${snapshot.preis_artikel.toFixed(2)} € → ${num(liveBuchung.Preis_Artikel).toFixed(2)} €`);
  }
  if (Math.abs(snapshot.preis_lieferung - num(liveBuchung.Preis_Lieferung)) > 0.005) {
    diffs.push(`Lieferung: ${snapshot.preis_lieferung.toFixed(2)} € → ${num(liveBuchung.Preis_Lieferung).toFixed(2)} €`);
  }
  if (Math.abs((snapshot.preis_abholung ?? 0) - num(liveBuchung.Preis_Abholung)) > 0.005) {
    diffs.push(`Abholung: ${(snapshot.preis_abholung ?? 0).toFixed(2)} € → ${num(liveBuchung.Preis_Abholung).toFixed(2)} €`);
  }
  if (Math.abs(snapshot.preis_aufbau - num(liveBuchung.Preis_Aufbau)) > 0.005) {
    diffs.push(`Aufbau: ${snapshot.preis_aufbau.toFixed(2)} € → ${num(liveBuchung.Preis_Aufbau).toFixed(2)} €`);
  }
  if (Math.abs(snapshot.kaution_soll_eur - num(liveBuchung.Kaution_Soll_Eur)) > 0.005) {
    diffs.push(`Kaution: ${snapshot.kaution_soll_eur.toFixed(2)} € → ${num(liveBuchung.Kaution_Soll_Eur).toFixed(2)} €`);
  }

  // Positionen-Diff: Anzahl-Vergleich pro Artikel
  const livePos = await fetchPositionen(liveBuchungId);
  const liveMap = new Map(livePos.map((p) => [p.artikel_id, p]));
  const snapMap = new Map(snapshot.positionen.map((p) => [p.artikel_id, p]));
  liveMap.forEach((lp, aid) => {
    const sp = snapMap.get(aid);
    if (!sp) {
      diffs.push(`Position hinzugefügt: ${lp.anzahl}× ${lp.bezeichnung}`);
    } else if (sp.anzahl !== lp.anzahl) {
      diffs.push(`${lp.bezeichnung}: ${sp.anzahl}× → ${lp.anzahl}×`);
    } else if (Math.abs(sp.einzelpreis - lp.einzelpreis) > 0.005) {
      diffs.push(`${lp.bezeichnung} Preis: ${sp.einzelpreis.toFixed(2)} € → ${lp.einzelpreis.toFixed(2)} €`);
    }
  });
  snapMap.forEach((sp, aid) => {
    if (!liveMap.has(aid)) {
      diffs.push(`Position entfernt: ${sp.anzahl}× ${sp.bezeichnung}`);
    }
  });

  // Kundenanschrift-Drift (nur informativ — wirkt sich auf Rechnung aus, nicht auf Angebots-Bestätigung)
  if (snapshot.kunde.adresse_strasse !== (liveKunde.Adresse_Strasse ?? "")) {
    diffs.push(`Anschrift: "${snapshot.kunde.adresse_strasse}" → "${liveKunde.Adresse_Strasse ?? ""}"`);
  }

  return diffs;
}
