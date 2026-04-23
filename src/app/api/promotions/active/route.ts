import { NextResponse } from 'next/server';
import { loadProductsData } from '@/lib/blob-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadProductsData();
  const today = new Date().toISOString().split('T')[0];
  const active = (data.promotions || []).find(
    p => p.active && (!p.expiresAt || p.expiresAt.split('T')[0] >= today)
  );
  if (!active) return NextResponse.json({ promotion: null }, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
  });
  return NextResponse.json({ promotion: active }, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
  });
}
