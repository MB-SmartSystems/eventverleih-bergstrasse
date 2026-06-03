/**
 * Verfuegbarkeits-Logik fuer Eventverleih-Artikel.
 *
 * Plan Phase 5 A2-A4:
 *   - Hart-Reservierte Buchungen (Status_Erweitert in [Reserviert, Uebergeben, In_Miete])
 *     blockieren die Verfuegbarkeit
 *   - Soft-Reservierte (Anfrage, Angebot_erstellt, Angebot_versendet, Bestaetigt)
 *     blockieren NICHT — Admin sieht sie nur als Warnung via checkConflicts()
 *   - Bestand-effektiv = Bestand_OK − Bestand_Repair − Bestand_Defekt
 *   - Nur Aktiv=true Artikel zaehlen
 *   - Liefert restzahl + bestand_gesamt fuer "nur noch X verfuegbar"-Anzeige
 *   - 30s in-memory Cache pro {artikelIds-Hash, von, bis}
 */
import { listAllRows, TABLES } from "@/lib/baserow/client";

const HARD_STATI = new Set(["Reserviert", "Uebergeben", "In_Miete"]);
const CACHE_TTL_MS = 30_000;

interface BuchungLite {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Rueckgabe_Termin: string | null;
}

/**
 * Prüf-Puffer NACH der Rückgabe: der Artikel ist erst nach der Schaden-Prüfung wieder
 * verfügbar (Manuel braucht ~2 Werktage). Wird auf das effektive Blockier-Ende addiert.
 */
const PRUEF_PUFFER_TAGE = 2;

function berlinDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  if (isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Effektives Blockier-Ende einer Buchung: Artikel sind aus dem Bestand, bis sie zurück
 * UND geprüft sind. = max(Event-Ende, Rückgabe-Termin) + Prüf-Puffer. Behebt das
 * Überbuchungs-Risiko bei spät vereinbarter Rückgabe (z.B. wegen Urlaub).
 */
function blockEndDate(b: BuchungLite): string | null {
  const ends: string[] = [];
  if (b.Event_datum_bis) ends.push(b.Event_datum_bis.slice(0, 10));
  if (b.Rueckgabe_Termin) ends.push(berlinDateOf(b.Rueckgabe_Termin));
  if (ends.length === 0) {
    if (!b.Event_datum_von) return null;
    ends.push(b.Event_datum_von.slice(0, 10));
  }
  const maxEnd = ends.sort().pop()!;
  return addDays(maxEnd, PRUEF_PUFFER_TAGE);
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
  Bestand_Reparatur?: string | number | null;
  Bestand_Defekt?: string | number | null;
  Bestand_Bestellbar?: boolean | { value: string } | null;
  Aktiv?: boolean | { value: string } | null;
}

export interface AvailabilityResult {
  artikel_id: number;
  artikel_name: string;
  available: boolean;
  restzahl: number;
  bestand_gesamt: number;
  /** Wenn true: Artikel ist auf-Bestellung verfuegbar (Bestand 0, aber Bestand_Bestellbar=true). Frontend behandelt nahtlos wie verfuegbar; Backend markiert die Buchungs-Position fuer Manuels Beschaffungs-Pruefung. */
  on_request: boolean;
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

function isAktiv(a: ArtikelLite): boolean {
  const v = a.Aktiv;
  if (v === undefined || v === null) return true; // Wenn kein Feld → annehmen aktiv
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && "value" in v) {
    const s = String(v.value || "").toLowerCase();
    return s === "ja" || s === "true" || s === "aktiv";
  }
  return Boolean(v);
}

function isBestellbar(a: ArtikelLite): boolean {
  const v = a.Bestand_Bestellbar;
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && "value" in v) {
    const s = String(v.value || "").toLowerCase();
    return s === "ja" || s === "true";
  }
  return Boolean(v);
}

// ----- Cache -----
type CacheEntry = { result: Map<number, AvailabilityResult>; expires: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(artikelIds: number[], von: string, bis: string): string {
  const sortedIds = [...artikelIds].sort((a, b) => a - b).join(",");
  return `${von}|${bis}|${sortedIds || "ALL"}`;
}

function cacheGet(key: string): Map<number, AvailabilityResult> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function cacheSet(key: string, result: Map<number, AvailabilityResult>): void {
  cache.set(key, { result, expires: Date.now() + CACHE_TTL_MS });
}

/**
 * Berechnet Verfuegbarkeit fuer eine Liste Artikel-IDs im gegebenen Zeitraum.
 *
 * @param artikelIds Liste Artikel-IDs (Baserow-Row-IDs)
 * @param von ISO-Datum YYYY-MM-DD
 * @param bis ISO-Datum YYYY-MM-DD
 * @returns Map artikel_id -> AvailabilityResult { available, restzahl, bestand_gesamt }
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

  const key = cacheKey(artikelIds, von, bis);
  const cached = cacheGet(key);
  if (cached) return cached;

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
    if (!rangeOverlaps(b.Event_datum_von, blockEndDate(b), von, bis)) continue;
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

  // Artikel-Daten mappen (Name + effektiver Bestand + Bestellbar-Flag)
  // effektiver Bestand = Bestand_OK − Bestand_Reparatur − Bestand_Defekt
  // Nur aktive Artikel werden positiv gerechnet, inaktive bekommen Bestand 0
  const artikelData = new Map<
    number,
    { name: string; bestandEffektiv: number; aktiv: boolean; bestellbar: boolean }
  >();
  for (const art of artikelRes.results) {
    const ok = parseInt0(art.Bestand_OK);
    const repair = parseInt0(art.Bestand_Reparatur);
    const defekt = parseInt0(art.Bestand_Defekt);
    const aktiv = isAktiv(art);
    const bestellbar = isBestellbar(art);
    artikelData.set(art.id, {
      name: art.Bezeichnung || "",
      bestandEffektiv: Math.max(0, ok - repair - defekt),
      aktiv,
      bestellbar,
    });
  }

  // Pro angefragten Artikel: available + restzahl + on_request
  const result = new Map<number, AvailabilityResult>();
  for (const aid of artikelIds) {
    const data = artikelData.get(aid);
    if (!data) {
      result.set(aid, {
        artikel_id: aid,
        artikel_name: "",
        available: false,
        restzahl: 0,
        bestand_gesamt: 0,
        on_request: false,
      });
      continue;
    }
    const belegt = belegungProArtikel.get(aid) ?? 0;
    const restzahlPhysisch = data.aktiv ? Math.max(0, data.bestandEffektiv - belegt) : 0;

    // On-Request: Artikel ist bestellbar markiert UND physisch nicht verfuegbar (Bestand 0 oder alles belegt).
    // Nahtlos im Frontend behandelt (= verfuegbar), aber on_request=true damit Backend Buchungs_Position markieren kann.
    const isOnRequest =
      data.aktiv && data.bestellbar && restzahlPhysisch === 0;

    result.set(aid, {
      artikel_id: aid,
      artikel_name: data.name,
      available: restzahlPhysisch > 0 || isOnRequest,
      restzahl: restzahlPhysisch,
      bestand_gesamt: data.bestandEffektiv,
      on_request: isOnRequest,
    });
  }

  cacheSet(key, result);
  return result;
}

/**
 * Convenience: ALLE aktiven Artikel verfuegbar pruefen, ohne explizit IDs angeben zu muessen.
 * Wird vom Sortiment-Frontend genutzt.
 */
export async function getAvailabilityForAllArtikel(
  von: string,
  bis: string,
): Promise<Map<number, AvailabilityResult>> {
  const artikelRes = await listAllRows<ArtikelLite>(TABLES.Artikel);
  const aktiveIds = artikelRes.results.filter((a) => isAktiv(a)).map((a) => a.id);
  return getAvailability(aktiveIds, von, bis);
}

/** Cache komplett leeren — nuetzlich nach Buchungs-Status-Wechsel via Webhook */
export function invalidateAvailabilityCache(): void {
  cache.clear();
}

const COMMITTED_STATI = new Set(["Bestaetigt", "Reserviert", "Uebergeben", "In_Miete"]);

export interface CommittedDemandResult {
  artikel_id: number;
  artikel_name: string;
  bestand: number; // effektiver Bestand
  committed_other: number; // bereits durch ANDERE committete Buchungen im Overlap gebunden
  frei: number; // bestand - committed_other (>= 0)
}

/**
 * Knappheits-Check fuer die Annahme einer Anfrage (Manuels "vorab-reserviert weich"-Modell):
 * Wieviel von jedem Artikel ist im Zeitraum bereits durch ANDERE committete Buchungen
 * (Bestaetigt/Reserviert/Uebergeben/In_Miete) gebunden? Blockt NICHT — liefert nur die
 * Zahlen fuer eine Warnung. `excludeBuchungId` = die aktuelle Anfrage/Buchung selbst.
 */
export async function getCommittedDemand(
  artikelIds: number[],
  von: string,
  bis: string,
  excludeBuchungId?: number,
): Promise<Map<number, CommittedDemandResult>> {
  const out = new Map<number, CommittedDemandResult>();
  if (artikelIds.length === 0 || !von || !bis) return out;

  const [buchungenRes, positionenRes, artikelRes] = await Promise.all([
    listAllRows<BuchungLite>(TABLES.Buchungen),
    listAllRows<BuchungsPositionLite>(TABLES.Buchungs_Position),
    listAllRows<ArtikelLite>(TABLES.Artikel),
  ]);

  const committedIds = new Set<number>();
  for (const b of buchungenRes.results) {
    if (excludeBuchungId && b.id === excludeBuchungId) continue;
    if (!COMMITTED_STATI.has(b.Status_Erweitert?.value || "")) continue;
    if (!rangeOverlaps(b.Event_datum_von, blockEndDate(b), von, bis)) continue;
    committedIds.add(b.id);
  }

  const demand = new Map<number, number>();
  for (const pos of positionenRes.results) {
    const bid = pos.Buchung_Link?.[0]?.id;
    if (!bid || !committedIds.has(bid)) continue;
    const anzahl = parseInt0(pos.Anzahl);
    if (anzahl <= 0) continue;
    for (const art of pos.Artikel_Link ?? []) {
      demand.set(art.id, (demand.get(art.id) ?? 0) + anzahl);
    }
  }

  const artById = new Map(artikelRes.results.map((a) => [a.id, a]));
  for (const aid of artikelIds) {
    const art = artById.get(aid);
    const bestand = art
      ? Math.max(0, parseInt0(art.Bestand_OK) - parseInt0(art.Bestand_Reparatur) - parseInt0(art.Bestand_Defekt))
      : 0;
    const committed_other = demand.get(aid) ?? 0;
    out.set(aid, {
      artikel_id: aid,
      artikel_name: art?.Bezeichnung || `Artikel ${aid}`,
      bestand,
      committed_other,
      frei: Math.max(0, bestand - committed_other),
    });
  }
  return out;
}
