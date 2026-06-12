import { NextResponse } from 'next/server';
import { loadProductsData, ensureSeeded } from '@/lib/blob-data';
import { SEED_DATA } from '@/lib/seed-data';
import { listAllRows, TABLES } from '@/lib/baserow/client';
import { normalizeArtikelName as normalize, tokensMatch } from '@/lib/eventverleih/artikel-match';

export const dynamic = 'force-dynamic';

interface ArtikelPricingRow {
  id: number;
  Bezeichnung: string;
  Mietpreis_WE_Eur: string | null;
  Kaution_Pro_Stueck_Eur: string | null;
  Aufbau_Pauschale_Eur: string | null;
}

async function loadArtikelPricing(): Promise<Map<string, ArtikelPricingRow>> {
  // Lade alle Artikel aus Baserow (paginiert), baue Lookup-Map nach normalisiertem Namen.
  // Bei Fehler: leere Map zurueck → Frontend faellt sauber zurueck auf Blob-Preise.
  try {
    const r = await listAllRows<ArtikelPricingRow>(TABLES.Artikel);
    const map = new Map<string, ArtikelPricingRow>();
    for (const a of r.results) {
      map.set(normalize(a.Bezeichnung), a);
    }
    return map;
  } catch (e) {
    console.error('[api/products] Baserow Artikel-Lookup fehlgeschlagen:', e);
    return new Map();
  }
}

function matchPricing(
  productName: string,
  map: Map<string, ArtikelPricingRow>,
): ArtikelPricingRow | null {
  const target = normalize(productName);
  // 1. exact match
  const direct = map.get(target);
  if (direct) return direct;
  // 2. contains match (longer-text Bezeichnung enthaelt Storefront-Name oder umgekehrt).
  // Array.from um downlevelIteration zu vermeiden (TS-Target ist ES5 im tsconfig).
  const entries = Array.from(map.entries());
  for (const [key, row] of entries) {
    if (key.includes(target) || target.includes(key)) return row;
  }
  // 3. token-sort match ("Gewicht — Metallplatte" ↔ "Metallplatten-Gewicht")
  for (const [key, row] of entries) {
    if (tokensMatch(key, target)) return row;
  }
  return null;
}

function parseDecOrNull(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null;
  const n = parseFloat(s);
  if (!isFinite(n) || n < 0) return null;
  return n;
}

export async function GET() {
  // Der Blob-Store kann gesperrt sein (Vercel-Quota-Suspension, erlebt 06/2026:
  // "This store has been suspended" → ensureSeeded warf → HTTP 500, Shop tot).
  // Die öffentliche Route darf daran nie sterben.
  try {
    await ensureSeeded();
  } catch (e) {
    console.error('[api/products] ensureSeeded fehlgeschlagen (Blob gesperrt?):', e);
  }
  let data = await loadProductsData();
  if (data.products.length === 0 || data.categories.length === 0) {
    // Blob leer/gesperrt → Repo-Katalog als Notfall-Stand. Nur der öffentliche
    // Lese-Pfad — der Admin-Schreibpfad behält seine Leer-Daten-Guardrails.
    // Deep-Clone, weil unten in-place sortiert wird (SEED_DATA bleibt unberührt).
    console.error('[api/products] Blob leer/gesperrt — serviere Repo-Seed-Fallback');
    data = JSON.parse(JSON.stringify(SEED_DATA)) as typeof data;
  }
  data.categories.sort((a, b) => a.order - b.order);

  // Filter out invisible products
  const visible = data.products.filter(p => p.visible !== false);

  // Get active promotion product IDs
  const today = new Date().toISOString().split('T')[0];
  const activePromo = (data.promotions || []).find(
    p => p.active && (!p.expiresAt || p.expiresAt.split('T')[0] >= today)
  );
  const promoIds = new Set(activePromo?.productIds || []);

  // Sort: promo products first, then pinned, then newest
  visible.sort((a, b) => {
    const aPromo = promoIds.has(a.id) ? 1 : 0;
    const bPromo = promoIds.has(b.id) ? 1 : 0;
    if (aPromo !== bPromo) return bPromo - aPromo;

    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const tsA = parseInt(a.id.replace(/^[a-z]-?/, '')) || 0;
    const tsB = parseInt(b.id.replace(/^[a-z]-?/, '')) || 0;
    return tsB - tsA;
  });

  // Baserow-Pricing-Lookup parallel zum Sort
  const pricingMap = await loadArtikelPricing();

  // Strip internal inventory fields, attach pricing extensions
  const publicProducts = visible.map((p) => {
    const pricing = matchPricing(p.name, pricingMap);
    return {
      id: p.id,
      category: p.category,
      images: p.images,
      image: p.image,
      name: p.name,
      description: p.description,
      price: p.price,
      priceUnit: p.priceUnit,
      youtubeLink: p.youtubeLink,
      tags: p.tags,
      visible: p.visible,
      pinned: p.pinned,
      // Cart-Pricing aus Baserow (kann null sein wenn nicht gepflegt oder Match fehlt)
      mietpreisEur: pricing ? parseDecOrNull(pricing.Mietpreis_WE_Eur) : null,
      kautionEur: pricing ? parseDecOrNull(pricing.Kaution_Pro_Stueck_Eur) : null,
      aufbauEur: pricing ? parseDecOrNull(pricing.Aufbau_Pauschale_Eur) : null,
      artikelId: pricing ? pricing.id : null,
    };
  });

  return NextResponse.json({ ...data, products: publicProducts }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
