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
