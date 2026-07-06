import { NextResponse } from 'next/server';
import { loadProductsData } from '@/lib/baserow-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Datenquelle ist jetzt Baserow (Artikel 957 + System_Konfiguration 955).
  // KEIN stiller Seed-/Leer-Fallback mehr: ist Baserow nicht erreichbar, liefern
  // wir einen ehrlichen 503 statt eines veralteten Repo-Katalogs (das stille
  // Leerlaufen hatte die alte Blob-Sperre wochenlang unsichtbar gemacht).
  let data;
  try {
    data = await loadProductsData();
  } catch (e) {
    console.error('[api/products] Baserow nicht erreichbar:', e);
    return NextResponse.json(
      { error: 'Katalog aktuell nicht verfügbar', products: [], categories: [], promotions: [] },
      { status: 503 },
    );
  }

  data.categories.sort((a, b) => a.order - b.order);

  // Nur sichtbare Produkte
  const visible = data.products.filter((p) => p.visible !== false);

  // Aktive Aktion bestimmen
  const today = new Date().toISOString().split('T')[0];
  const activePromo = (data.promotions || []).find(
    (p) => p.active && (!p.expiresAt || p.expiresAt.split('T')[0] >= today),
  );
  const promoIds = new Set(activePromo?.productIds || []);

  // Sortierung: Aktion zuerst, dann angepinnt, dann neueste (numerischer id-Anteil).
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

  // Interne Inventar-Felder abstreifen; Cart-Pricing kommt bereits aus der
  // Artikel-Zeile (kein Name-Matching mehr noetig — es IST die Artikel-Tabelle).
  const publicProducts = visible.map((p) => ({
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
    sortOrder: p.sortOrder ?? 0,
    mietpreisEur: p.mietpreisEur ?? null,
    kautionEur: p.kautionEur ?? null,
    aufbauEur: p.aufbauEur ?? null,
    artikelId: p.artikelId ?? null,
    slug: p.slug,
    bestandOk: p.quantityOk,
  }));

  return NextResponse.json(
    { ...data, products: publicProducts },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  );
}
