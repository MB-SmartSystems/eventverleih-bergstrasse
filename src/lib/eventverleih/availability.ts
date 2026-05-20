/**
 * Verfuegbarkeits-Logik fuer Eventverleih-Artikel.
 *
 * Plan ich-hab-mal-bitte-snappy-boole, Punkt 7:
 *   - Hart-Reservierte Buchungen (Status_Erweitert in [Reserviert, Uebergeben, In_Miete])
 *     blockieren die Verfuegbarkeit.
 *   - Soft-Reservierte Buchungen (Anfrage, Angebot_erstellt, Angebot_versendet, Bestaetigt)
 *     blockieren NICHT — der Manuel sieht sie nur als Warnung im Admin via checkConflicts().
 *
 * Verfuegbarkeit fuer einen Artikel im Zeitraum:
 *   verfuegbar = Bestand_OK > Summe(Anzahl) aller Buchungs_Position-Rows,
 *                deren Buchung Hart-Status hat UND Datums-Overlap mit [von, bis].
 *
 * Im Kunden-UI wird NUR ein boolean (ja/nein) zurueckgegeben — keine Anzahl-Anzeige.
 */
import { listAllRows, TABLES } from "@/lib/baserow/client";

const HARD_STATI = new Set(["Reserviert", "Uebergeben", "In_Miete"]);

interface BuchungLite {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
}

interface BuchungsPositionLite {
  id: number;
  Buchung_Link: Array<{ id: number; value: string }> | null;
  Artikel_Link: Array<{ id: number; value: string }> | null;
  Anzahl: string | null;
}

interface ArtikelLite {
  id: number;
  Bezeichnung?: string;
  Bestand_OK: string | number | null;
  Aktiv?: boolean;
}

export interface AvailabilityResult {
  artikel_id: number;
  artikel_name: string;
  available: boolean;
}

function parseInt0(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

function rangeOverlaps(
  aVon: string | null,
  aBis: string | null,
  bVon: string,
  bBis: string,
): boolean {
  if (!aVon || !aBis) return false;
  return aVon <= bBis && aBis >= bVon;
}

/**
 * Berechnet Verfuegbarkeit fuer eine Liste Artikel-IDs im gegebenen Zeitraum.
 *
 * @param artikelIds Liste Artikel-IDs (Baserow-Row-IDs)
 * @param von ISO-Datum YYYY-MM-DD
 * @param bis ISO-Datum YYYY-MM-DD
 * @returns Map artikel_id -> { available: boolean }
 */
export async function getAvailability(
  artikelIds: number[],
  von: string,
  bis: string,
): Promise<Map<number, AvailabilityResult>> {
  if (artikelIds.length === 0) return new Map();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
    throw new Error("getAvailability: von/bis muessen YYYY-MM-DD sein");
  }
  if (bis < von) {
    throw new Error("getAvailability: bis < von");
  }

  // Lade Buchungen + Buchungs_Position + Artikel parallel
  const [buchungenRes, positionenRes, artikelRes] = await Promise.all([
    listAllRows<BuchungLite>(TABLES.Buchungen),
    listAllRows<BuchungsPositionLite>(TABLES.Buchungs_Position),
    listAllRows<ArtikelLite>(TABLES.Artikel),
  ]);

  // Set aller Hart-Reservierten Buchung-IDs im Datums-Overlap
  const hartBuchungIds = new Set<number>();
  for (const b of buchungenRes.results) {
    const status = b.Status_Erweitert?.value || "";
    if (!HARD_STATI.has(status)) continue;
    if (!rangeOverlaps(b.Event_datum_von, b.Event_datum_bis, von, bis)) continue;
    hartBuchungIds.add(b.id);
  }

  // Summiere gebuchte Mengen pro Artikel-ID aus diesen Buchungen
  const belegungProArtikel = new Map<number, number>();
  for (const pos of positionenRes.results) {
    const bid = pos.Buchung_Link?.[0]?.id;
    if (!bid || !hartBuchungIds.has(bid)) continue;
    const anzahl = parseInt0(pos.Anzahl);
    if (anzahl <= 0) continue;
    for (const art of pos.Artikel_Link ?? []) {
      const cur = belegungProArtikel.get(art.id) ?? 0;
      belegungProArtikel.set(art.id, cur + anzahl);
    }
  }

  // Artikel-Bestand abrufen + Name lookup
  const bestandProArtikel = new Map<number, number>();
  const nameProArtikel = new Map<number, string>();
  for (const art of artikelRes.results) {
    bestandProArtikel.set(art.id, parseInt0(art.Bestand_OK));
    nameProArtikel.set(art.id, art.Bezeichnung || "");
  }

  // Pro angefragten Artikel: available = Bestand > Belegung
  const result = new Map<number, AvailabilityResult>();
  for (const aid of artikelIds) {
    const bestand = bestandProArtikel.get(aid) ?? 0;
    const belegt = belegungProArtikel.get(aid) ?? 0;
    result.set(aid, {
      artikel_id: aid,
      artikel_name: nameProArtikel.get(aid) || "",
      available: bestand > belegt,
    });
  }
  return result;
}

/**
 * Convenience: ALLE Artikel verfuegbar pruefen, ohne explizit IDs angeben zu muessen.
 * Wird vom Sortiment-Frontend genutzt.
 */
export async function getAvailabilityForAllArtikel(
  von: string,
  bis: string,
): Promise<Map<number, AvailabilityResult>> {
  const artikelRes = await listAllRows<ArtikelLite>(TABLES.Artikel);
  return getAvailability(
    artikelRes.results.map((a) => a.id),
    von,
    bis,
  );
}
