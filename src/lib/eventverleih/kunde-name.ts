/**
 * Kunden-Anzeigename aus einem Baserow-Link-Feld aufloesen.
 *
 * WICHTIG: `Kunde_Link[0].value` ist das PRIMAERFELD der Kunden-Tabelle = Kunde_ID
 * (eine Zahl!) — NIE als Anrede verwenden. Bug 2026-06-05: Kunde Marvin Kraemer
 * bekam eine Zahlungsbestaetigung mit "Hallo 12". Immer die Kunden-Row laden und
 * Vorname + Nachname nehmen.
 */
import { getRow, TABLES } from "@/lib/baserow/client";

type KundeLink = Array<{ id: number; value?: string }> | null | undefined;

/** Name per Kunden-Row-ID laden — mit 1 Retry (transienter Baserow-Fail erzeugte schon ein "Hallo ,"). */
export async function kundeNameById(kid: number | null | undefined, fallback = ""): Promise<string> {
  if (!kid) return fallback;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const k = await getRow<{ Vorname?: string | null; Nachname?: string | null }>(TABLES.Kunden, kid);
      return `${k.Vorname ?? ""} ${k.Nachname ?? ""}`.trim() || fallback;
    } catch {
      // einmal kurz erneut versuchen, dann Fallback
    }
  }
  return fallback;
}

export async function kundeNameAusLink(link: KundeLink, fallback = ""): Promise<string> {
  return kundeNameById(link?.[0]?.id, fallback);
}
