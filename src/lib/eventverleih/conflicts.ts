/**
 * Mengen-genaue Engpass-Erkennung fuer parallele, hart-reservierte Buchungen.
 * Genutzt vom Dashboard (Live-Anzeige) + Stripe-Webhook (Flag nach Anzahlungseingang).
 * (Die alte mengen-blinde checkConflicts-Logik wurde 2026-05-27 entfernt.)
 */
import { listAllRows, TABLES } from "@/lib/baserow/client";

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

interface BuchungsPositionRow {
  id: number;
  Buchung_Link: Array<{ id: number; value: string }> | null;
  Artikel_Link: Array<{ id: number; value: string }> | null;
}

const HARD_STATI = new Set(["Reserviert", "Uebergeben", "In_Miete"]);

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
