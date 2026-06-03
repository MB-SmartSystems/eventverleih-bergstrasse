/**
 * Sperrzeiten (Urlaub o. ä.) — Zeiträume, in denen keine Übergabe/Rückgabe möglich ist.
 *
 * Manuel pflegt sie selbst im Admin (/admin/sperrzeiten). Sie BLOCKEN nichts hart —
 * sie liefern nur eine WARNUNG, wenn eine Anfrage eine Übergabe (≈ Event-Start) oder
 * Rückgabe (≈ Event-Ende + Prüf-Puffer) in einem gesperrten Zeitraum nötig machen würde.
 */
import { listAllRows, TABLES } from "@/lib/baserow/client";

export interface Sperrzeit {
  id: number;
  von: string; // YYYY-MM-DD
  bis: string; // YYYY-MM-DD
  grund: string;
}

interface SperrzeitRow {
  id: number;
  Name?: string | null;
  Aktiv?: boolean | { value: string } | null;
  Von: string | null;
  Bis: string | null;
  Grund: string | null;
}

function isAktiv(v: SperrzeitRow["Aktiv"]): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && "value" in v) {
    const s = String(v.value || "").toLowerCase();
    return s === "ja" || s === "true" || s === "aktiv";
  }
  return Boolean(v);
}

export async function getSperrzeiten(): Promise<Sperrzeit[]> {
  const res = await listAllRows<SperrzeitRow>(TABLES.Sperrzeiten);
  return res.results
    .filter((r) => r.Von && r.Bis && isAktiv(r.Aktiv))
    .map((r) => ({
      id: r.id,
      von: (r.Von as string).slice(0, 10),
      bis: (r.Bis as string).slice(0, 10),
      grund: r.Grund || r.Name || "Gesperrt",
    }))
    .sort((a, b) => a.von.localeCompare(b.von));
}

/** Liegt ein Datum (YYYY-MM-DD) in einer Sperrzeit? Liefert die Sperrzeit oder null. */
export function dateInSperrzeit(ymd: string, sperrzeiten: Sperrzeit[]): Sperrzeit | null {
  for (const s of sperrzeiten) {
    if (ymd >= s.von && ymd <= s.bis) return s;
  }
  return null;
}

export interface SperrzeitKonflikt {
  was: "Übergabe" | "Rückgabe";
  datum: string;
  sperrzeit: Sperrzeit;
}

/**
 * Prüft, ob die Übergabe (≈ Event-Start) oder Rückgabe (≈ Event-Ende, + Puffer-Tag)
 * in eine Sperrzeit fällt. `pufferTage` = wie viele Tage nach Event-Ende noch eine
 * Rücknahme nötig sein könnte (Default 2, analog Prüf-Puffer).
 */
export function checkSperrzeitKonflikt(
  eventVon: string | null,
  eventBis: string | null,
  sperrzeiten: Sperrzeit[],
  pufferTage = 2,
): SperrzeitKonflikt[] {
  const konflikte: SperrzeitKonflikt[] = [];
  if (sperrzeiten.length === 0) return konflikte;

  if (eventVon) {
    const ueb = eventVon.slice(0, 10);
    const s = dateInSperrzeit(ueb, sperrzeiten);
    if (s) konflikte.push({ was: "Übergabe", datum: ueb, sperrzeit: s });
  }
  if (eventBis) {
    // Rückgabe-Fenster: Event-Ende bis Event-Ende + Puffer
    const end = new Date(eventBis.slice(0, 10) + "T00:00:00Z");
    for (let i = 0; i <= pufferTage; i++) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() + i);
      const ymd = d.toISOString().slice(0, 10);
      const s = dateInSperrzeit(ymd, sperrzeiten);
      if (s) {
        konflikte.push({ was: "Rückgabe", datum: ymd, sperrzeit: s });
        break;
      }
    }
  }
  return konflikte;
}
