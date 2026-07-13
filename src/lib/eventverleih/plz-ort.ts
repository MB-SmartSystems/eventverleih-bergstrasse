/**
 * PLZ → Ort Autofill (client-seitig).
 *
 * Lädt die Zuordnungstabelle `public/data/plz-ort.json` (8255 dt. PLZ, ~56 KB gzip)
 * einmalig und lazy per same-origin fetch — kein externer Dienst, keine Laufzeit-API,
 * kein CSP-/DSGVO-Problem (die PLZ verlässt den Browser nicht).
 *
 * Quelle des Datensatzes: offene German-Zip-Codes-Liste (PLZ→Ort, first-seen pro PLZ).
 * Bewusst editierbar im Formular: ist eine PLZ nicht enthalten, bleibt das Ort-Feld leer
 * und der Nutzer trägt selbst ein — nie ein Fehler.
 */

let cache: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

async function loadMap(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = fetch("/data/plz-ort.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: Record<string, string>) => {
      cache = data && typeof data === "object" ? data : {};
      return cache;
    })
    .catch(() => {
      cache = {};
      return cache;
    });
  return loading;
}

/**
 * Liefert den Ort zu einer 5-stelligen PLZ oder null, wenn nicht gefunden.
 * Nicht-5-stellige Eingaben → null (kein Lookup).
 */
export async function ortFuerPlz(plz: string): Promise<string | null> {
  const clean = (plz || "").trim();
  if (!/^\d{5}$/.test(clean)) return null;
  const map = await loadMap();
  return map[clean] ?? null;
}
