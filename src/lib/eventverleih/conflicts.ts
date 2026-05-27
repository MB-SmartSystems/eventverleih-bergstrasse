/**
 * Konflikt-Detection fuer parallele Buchungen.
 *
 * Wird beim Status-Wechsel auf "Angebot_versendet" oder "Bestaetigt" aufgerufen.
 * Prueft ob andere Buchungen mit ueberlappendem Datum-Range UND gemeinsamen
 * Artikel-Positionen existieren (Status >= Angebot_versendet, also nicht Storniert/No_Show/Anfrage).
 *
 * Returns: Liste konkurrierender Buchungs-IDs mit Match-Details.
 */
import { listAllRows, getRow, TABLES } from "@/lib/baserow/client";

export interface ConflictMatch {
  buchung_id: number;
  status: string;
  is_hard: boolean; // true = bereits angezahlt (Reserviert/Uebergeben/In_Miete), false = vorab reserviert
  datum_von: string;
  datum_bis: string;
  kunde_name: string;
  shared_artikel_ids: number[];
  shared_artikel_namen: string[];
}

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
  Buchungs_Position: Array<{ id: number; value: string }> | null;
}

interface BuchungsPositionRow {
  id: number;
  Buchung_Link: Array<{ id: number; value: string }> | null;
  Artikel_Link: Array<{ id: number; value: string }> | null;
}

// Status-Klassifizierung (Plan ich-hab-mal-bitte-snappy-boole, Punkt 3):
// Soft = vorab-reserviert (noch keine Anzahlung) → Konflikt wird als Warnung im Admin angezeigt,
//        blockt aber NICHT die Verfuegbarkeit fuer neue Kunden-Anfragen
// Hard = fest-reserviert (Anzahlung eingegangen) → blockt die Verfuegbarkeit hart
const SOFT_STATI = new Set([
  "Anfrage",
  "Angebot_erstellt",
  "Angebot_versendet",
  "Bestaetigt",
]);
const HARD_STATI = new Set(["Reserviert", "Uebergeben", "In_Miete"]);
const ALL_BLOCKING = new Set<string>([
  "Anfrage",
  "Angebot_erstellt",
  "Angebot_versendet",
  "Bestaetigt",
  "Reserviert",
  "Uebergeben",
  "In_Miete",
]);

export function isHardStatus(status: string): boolean {
  return HARD_STATI.has(status);
}

/**
 * Prueft fuer eine Buchung, ob sie mit anderen aktiven Buchungen konfligiert.
 *
 * @param buchungId Buchung deren Konflikte geprueft werden sollen
 * @returns Liste konkurrierender Buchungen (leer = kein Konflikt)
 */
export async function checkConflicts(buchungId: number): Promise<ConflictMatch[]> {
  const target = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);

  if (!target.Event_datum_von || !target.Event_datum_bis) {
    return []; // Ohne Datum kein Konflikt-Check moeglich
  }
  const targetVon = new Date(target.Event_datum_von);
  const targetBis = new Date(target.Event_datum_bis);

  // Hole alle Buchungs-Positionen der Ziel-Buchung
  const positionen = await listAllRows<BuchungsPositionRow>(TABLES.Buchungs_Position);
  const targetPositionen = positionen.results.filter(
    (p) => (p.Buchung_Link ?? []).some((b) => b.id === buchungId),
  );
  const targetArtikelIds = new Set<number>();
  for (const pos of targetPositionen) {
    for (const art of pos.Artikel_Link ?? []) {
      targetArtikelIds.add(art.id);
    }
  }
  if (targetArtikelIds.size === 0) {
    return []; // Keine Artikel = kein Konflikt-Vektor
  }

  // Hole alle aktiven Buchungen (Soft + Hard)
  const buchungen = await listAllRows<BuchungRow>(TABLES.Buchungen);
  const candidates = buchungen.results.filter((b) => {
    if (b.id === buchungId) return false;
    const status = b.Status_Erweitert?.value || "";
    if (!ALL_BLOCKING.has(status)) return false;
    if (!b.Event_datum_von || !b.Event_datum_bis) return false;
    const von = new Date(b.Event_datum_von);
    const bis = new Date(b.Event_datum_bis);
    // Datums-Range-Overlap: A ueberlappt mit B wenn A.von <= B.bis UND A.bis >= B.von
    return von <= targetBis && bis >= targetVon;
  });

  if (candidates.length === 0) return [];

  // Pro Kandidat: Position-Overlap pruefen
  const conflicts: ConflictMatch[] = [];
  for (const cand of candidates) {
    const candPositionen = positionen.results.filter(
      (p) => (p.Buchung_Link ?? []).some((b) => b.id === cand.id),
    );
    const sharedArtikelIds: number[] = [];
    const sharedArtikelNamen: string[] = [];
    for (const pos of candPositionen) {
      for (const art of pos.Artikel_Link ?? []) {
        if (targetArtikelIds.has(art.id) && !sharedArtikelIds.includes(art.id)) {
          sharedArtikelIds.push(art.id);
          sharedArtikelNamen.push(art.value);
        }
      }
    }
    if (sharedArtikelIds.length === 0) continue;

    const candStatus = cand.Status_Erweitert?.value || "";
    conflicts.push({
      buchung_id: cand.id,
      status: candStatus,
      is_hard: HARD_STATI.has(candStatus),
      datum_von: cand.Event_datum_von!,
      datum_bis: cand.Event_datum_bis!,
      kunde_name: cand.Kunde_Link?.[0]?.value || "(unbekannt)",
      shared_artikel_ids: sharedArtikelIds,
      shared_artikel_namen: sharedArtikelNamen,
    });
  }

  return conflicts;
}

// ---- Mengen-genaue Engpass-Erkennung (first-to-pay-wins: FLAG statt Auto-Storno) ----
//
// Im Gegensatz zu checkConflicts() (mengen-blind, schlaegt bei jedem geteilten Artikel an)
// erkennt dies nur ECHTE Engpaesse: summierte gebuchte Menge eines geteilten, NICHT
// bestellbaren Artikels > effektiver Bestand im ueberlappenden Zeitraum, unter rein
// hart-reservierten Buchungen. Auto-clearing: sobald eine Buchung storniert wird, der
// Bestand reicht oder der Artikel auf "bestellbar" gesetzt wird, faellt der Eintrag weg.

export interface StockConflictGroup {
  artikel_id: number;
  artikel_name: string;
  bestand: number;
  nachgefragt: number;
  datum_von: string;
  datum_bis: string;
  buchungen: Array<{ id: number; kunde_name: string; anzahl: number }>;
}

interface ArtikelStockRow {
  id: number;
  Bezeichnung?: string;
  Bestand_OK: string | number | null;
  Bestand_Reparatur?: string | number | null;
  Bestand_Defekt?: string | number | null;
  Bestand_Bestellbar?: boolean | { value: string } | null;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

function isBestellbarFlag(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    const s = String((v as { value?: unknown }).value || "").toLowerCase();
    return s === "ja" || s === "true";
  }
  return Boolean(v);
}

function datesOverlap(
  aVon: string | null,
  aBis: string | null,
  bVon: string | null,
  bBis: string | null,
): boolean {
  if (!aVon || !aBis || !bVon || !bBis) return false;
  return aVon <= bBis && aBis >= bVon;
}

/**
 * Listet ALLE aktuell offenen Mengen-Engpaesse unter hart-reservierten Buchungen.
 * Genutzt vom Dashboard (Live-Anzeige, immer aktuell) und vom Stripe-Webhook
 * (Flag nach Anzahlungseingang).
 */
export async function listOpenStockConflicts(): Promise<StockConflictGroup[]> {
  const [buchungenRes, positionenRes, artikelRes] = await Promise.all([
    listAllRows<BuchungRow>(TABLES.Buchungen),
    listAllRows<BuchungsPositionRow & { Anzahl: string | number | null }>(TABLES.Buchungs_Position),
    listAllRows<ArtikelStockRow>(TABLES.Artikel),
  ]);

  const hardBuchungen = buchungenRes.results.filter(
    (b) =>
      HARD_STATI.has(b.Status_Erweitert?.value || "") &&
      b.Event_datum_von &&
      b.Event_datum_bis,
  );
  if (hardBuchungen.length < 2) return [];

  const artikelById = new Map<number, ArtikelStockRow>();
  for (const a of artikelRes.results) artikelById.set(a.id, a);

  // Pro Buchung: Artikel-ID -> summierte Anzahl
  const posByBuchung = new Map<number, Map<number, number>>();
  for (const p of positionenRes.results) {
    const bid = p.Buchung_Link?.[0]?.id;
    if (!bid) continue;
    const anzahl = toNum(p.Anzahl);
    if (anzahl <= 0) continue;
    for (const art of p.Artikel_Link ?? []) {
      let m = posByBuchung.get(bid);
      if (!m) {
        m = new Map();
        posByBuchung.set(bid, m);
      }
      m.set(art.id, (m.get(art.id) ?? 0) + anzahl);
    }
  }

  const groups = new Map<string, StockConflictGroup>();
  for (const anchor of hardBuchungen) {
    const overlapping = hardBuchungen.filter((b) =>
      datesOverlap(
        anchor.Event_datum_von,
        anchor.Event_datum_bis,
        b.Event_datum_von,
        b.Event_datum_bis,
      ),
    );
    if (overlapping.length < 2) continue;

    // Bedarf je Artikel in der Overlap-Gruppe
    const demand = new Map<
      number,
      { total: number; contrib: Array<{ id: number; kunde_name: string; anzahl: number }> }
    >();
    for (const b of overlapping) {
      const m = posByBuchung.get(b.id);
      if (!m) continue;
      const kunde_name = b.Kunde_Link?.[0]?.value || "(unbekannt)";
      for (const [artId, anzahl] of Array.from(m)) {
        let d = demand.get(artId);
        if (!d) {
          d = { total: 0, contrib: [] };
          demand.set(artId, d);
        }
        d.total += anzahl;
        d.contrib.push({ id: b.id, kunde_name, anzahl });
      }
    }

    for (const [artId, d] of Array.from(demand)) {
      if (d.contrib.length < 2) continue; // nur echte Mehrfach-Belegung
      const art = artikelById.get(artId);
      if (!art) continue;
      if (isBestellbarFlag(art.Bestand_Bestellbar)) continue; // nachkaufbar -> kein Konflikt
      const stock = Math.max(
        0,
        toNum(art.Bestand_OK) - toNum(art.Bestand_Reparatur) - toNum(art.Bestand_Defekt),
      );
      if (d.total <= stock) continue;
      const ids = d.contrib.map((c) => c.id).sort((a, b) => a - b);
      const key = `${artId}:${ids.join(",")}`;
      if (groups.has(key)) continue;
      groups.set(key, {
        artikel_id: artId,
        artikel_name: art.Bezeichnung || `Artikel ${artId}`,
        bestand: stock,
        nachgefragt: d.total,
        datum_von: anchor.Event_datum_von!,
        datum_bis: anchor.Event_datum_bis!,
        buchungen: d.contrib,
      });
    }
  }
  return Array.from(groups.values());
}
