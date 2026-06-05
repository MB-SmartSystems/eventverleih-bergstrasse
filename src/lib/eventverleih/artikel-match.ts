/**
 * Shared Artikel-Name-Matching: Storefront-Produktnamen ↔ Baserow-Artikel-Bezeichnungen.
 *
 * Single Source fuer normalize() + tokensMatch() — vorher 3 driftende Kopien in
 * /api/contact, /api/products und Sortiment.tsx. Die Drift hat einen echten Bug
 * verursacht (Anfrage B28: "Gewicht — Metallplatte" matchte "Metallplatten-Gewicht"
 * nicht, 6 Positionen fehlten im Angebot), weil tokensMatch nur im Frontend lebte.
 *
 * Match-Stufen (matchByName): exact → contains → token-sort.
 */

export function normalizeArtikelName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "a", ö: "o", ü: "u", ß: "ss" }[c] || c))
    .replace(/×/g, "x") // Storefront-Catalog nutzt Unicode-Multiplikation, Baserow ASCII
    .replace(/[—–−]/g, "-") // Em/En-Dash → Hyphen
    .replace(/[()[\]{}]/g, " ") // Klammern → Spaces ("Hochzeitsbogen (inkl. Abdeckung)")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token-Sort-Match: gleiche Tokens unabhaengig von Reihenfolge.
 * „gewicht-metallplatte" vs „metallplatten-gewicht" → Tokens [gewicht, metallplatte(n)]
 * Substring je Token toleriert Plural/Singular („metallplatte" in „metallplatten").
 * Erwartet bereits normalisierte Strings.
 */
export function tokensMatch(a: string, b: string): boolean {
  const tokenize = (s: string) => s.split(/[-\s]+/).filter((t) => t.length >= 3);
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return false;
  // Jeder Token aus dem kuerzeren Set muss in einem Token aus dem laengeren stecken
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return shorter.every((t) => longer.some((l) => l.includes(t) || t.includes(l)));
}

/**
 * Findet das Element, dessen Bezeichnung den Namen matcht.
 * Stufen: 1. exact, 2. contains (beide Richtungen), 3. token-sort.
 */
export function matchByName<T>(
  name: string,
  items: T[],
  getBezeichnung: (item: T) => string,
): T | null {
  const target = normalizeArtikelName(name);
  // 1. exact match
  let found = items.find((i) => normalizeArtikelName(getBezeichnung(i)) === target);
  if (found) return found;
  // 2. contains match (z.B. "Faltzelt 3x6" → "Faltzelt 3x6 m")
  found = items.find((i) => {
    const n = normalizeArtikelName(getBezeichnung(i));
    return n.includes(target) || target.includes(n);
  });
  if (found) return found;
  // 3. token-sort match (Word-Order-tolerant: "Gewicht — Metallplatte" → "Metallplatten-Gewicht")
  found = items.find((i) => tokensMatch(normalizeArtikelName(getBezeichnung(i)), target));
  return found ?? null;
}
