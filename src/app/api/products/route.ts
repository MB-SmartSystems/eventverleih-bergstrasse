import { NextResponse } from 'next/server';
import { loadProductsData, ensureSeeded } from '@/lib/blob-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSeeded();
  const data = await loadProductsData();
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

  data.products = visible;
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
  });
}
