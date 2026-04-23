import { NextResponse } from 'next/server';
import { loadProductsData } from '@/lib/blob-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadProductsData();
  const s = data.settings || {};
  return NextResponse.json({
    phone: s.phone || '',
    whatsapp: s.whatsapp || '',
    email: s.email || '',
    instagram: s.instagram || '',
    heroImage: s.heroImage || '',
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
