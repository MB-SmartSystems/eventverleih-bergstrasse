/**
 * Liest System_Konfiguration aus Baserow als Key-Value-Map.
 * Cache pro Request via React cache().
 */
import { cache } from "react";
import { listRows, TABLES } from "@/lib/baserow/client";

type ConfigRow = {
  id: number;
  Schluessel: string;
  Wert_Text: string | null;
  Wert_Zahl: string | null;
  Wert_JSON: string | null;
};

export const getSystemKonfig = cache(async () => {
  const list = await listRows<ConfigRow>(TABLES.System_Konfiguration, { size: 200 });
  const map = new Map<string, { text: string | null; zahl: number | null; json: unknown }>();
  for (const row of list.results) {
    if (!row.Schluessel) continue;
    map.set(row.Schluessel, {
      text: row.Wert_Text ?? null,
      zahl: row.Wert_Zahl ? parseFloat(row.Wert_Zahl) : null,
      json: row.Wert_JSON ? safeParseJson(row.Wert_JSON) : null,
    });
  }
  return map;
});

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function configText(map: Awaited<ReturnType<typeof getSystemKonfig>>, key: string, fallback = ""): string {
  return map.get(key)?.text ?? fallback;
}

export function configZahl(map: Awaited<ReturnType<typeof getSystemKonfig>>, key: string, fallback = 0): number {
  return map.get(key)?.zahl ?? fallback;
}
