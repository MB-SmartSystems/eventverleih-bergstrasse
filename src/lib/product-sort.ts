import type { RentalProduct } from './types';

// Einzige Quelle der Produkt-Reihenfolge — von Storefront (Sortiment.tsx) UND
// Admin (produkte/page.tsx) verwendet, damit beide Ansichten IMMER exakt gleich
// sortieren (sonst zeigt der Admin eine andere Reihenfolge als die Website).
//  1. Angepinnte Produkte zuerst (Override obenauf).
//  2. Website_Sortierung (sortOrder) aufsteigend — das per Drag & Drop im Admin
//     gesetzte Feld.
//  3. Stabiler Tiebreaker über die id, damit zwei gleiche sortOrder-Werte nie
//     zwischen den Ansichten kippen.
export function compareProducts(a: RentalProduct, b: RentalProduct): number {
  const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
  if (pin !== 0) return pin;
  const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (so !== 0) return so;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}
