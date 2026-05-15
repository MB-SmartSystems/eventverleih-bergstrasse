/**
 * Settings-Helper: liest System_Konfiguration (T955) Key-Value-Tabelle.
 *
 * Eingefuehrte Keys (Phase 1.1):
 *   - eve.storno.frist_volle_erstattung_tage     (default 14)
 *   - eve.storno.frist_halbe_erstattung_tage     (default 7)
 *   - eve.restzahlung.tage_vor_event             (default 7)
 *   - eve.kaution.hold_tage                      (default 7)
 *   - eve.soft_block.sichtbar_andere_anfragen    (default 1=ja)
 */
import { listAllRows, TABLES } from "@/lib/baserow/client";

export interface EveSettings {
  storno_volle_erstattung_tage: number;
  storno_halbe_erstattung_tage: number;
  restzahlung_tage_vor_event: number;
  kaution_hold_tage: number;
  soft_block_sichtbar_andere_anfragen: boolean;
}

const DEFAULTS: EveSettings = {
  storno_volle_erstattung_tage: 14,
  storno_halbe_erstattung_tage: 7,
  restzahlung_tage_vor_event: 7,
  kaution_hold_tage: 7,
  soft_block_sichtbar_andere_anfragen: true,
};

interface KonfigRow {
  Schluessel: string;
  Wert_Zahl: number | null;
  Wert_Text: string | null;
}

let _cache: { data: EveSettings; ts: number } | null = null;
const CACHE_MS = 60_000;

export async function loadEveSettings(): Promise<EveSettings> {
  if (_cache && Date.now() - _cache.ts < CACHE_MS) {
    return _cache.data;
  }
  try {
    const all = await listAllRows<KonfigRow>(TABLES.System_Konfiguration);
    const map = new Map<string, KonfigRow>();
    for (const r of all.results) {
      if (r.Schluessel) map.set(r.Schluessel, r);
    }
    const data: EveSettings = {
      storno_volle_erstattung_tage:
        map.get("eve.storno.frist_volle_erstattung_tage")?.Wert_Zahl ??
        DEFAULTS.storno_volle_erstattung_tage,
      storno_halbe_erstattung_tage:
        map.get("eve.storno.frist_halbe_erstattung_tage")?.Wert_Zahl ??
        DEFAULTS.storno_halbe_erstattung_tage,
      restzahlung_tage_vor_event:
        map.get("eve.restzahlung.tage_vor_event")?.Wert_Zahl ??
        DEFAULTS.restzahlung_tage_vor_event,
      kaution_hold_tage:
        map.get("eve.kaution.hold_tage")?.Wert_Zahl ?? DEFAULTS.kaution_hold_tage,
      soft_block_sichtbar_andere_anfragen:
        (map.get("eve.soft_block.sichtbar_andere_anfragen")?.Wert_Zahl ?? 1) >= 1,
    };
    _cache = { data, ts: Date.now() };
    return data;
  } catch (e) {
    console.error("[eve-settings] load failed, using defaults:", e);
    return DEFAULTS;
  }
}

/**
 * Berechnet Erstattung gemaess Storno-Staffel.
 *
 * Wenn Event > volle_erstattung_tage entfernt: 100%
 * Sonst wenn Event > halbe_erstattung_tage entfernt: 50%
 * Sonst: 0%
 */
export function calculateStornoErstattung(
  eventDateIso: string | null,
  bezahltEur: number,
  settings: EveSettings,
): { erstattung_eur: number; tage_bis_event: number; quote: number } {
  if (!eventDateIso) return { erstattung_eur: 0, tage_bis_event: -1, quote: 0 };
  const eventDate = new Date(eventDateIso);
  const tage = Math.floor((eventDate.getTime() - Date.now()) / 86_400_000);
  let quote = 0;
  if (tage > settings.storno_volle_erstattung_tage) quote = 1.0;
  else if (tage > settings.storno_halbe_erstattung_tage) quote = 0.5;
  else quote = 0;
  return {
    erstattung_eur: Math.round(bezahltEur * quote * 100) / 100,
    tage_bis_event: tage,
    quote,
  };
}
