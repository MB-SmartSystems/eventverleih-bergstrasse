import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await loadProductsData();
  return NextResponse.json({ promotions: data.promotions || [] });
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, description, expiresAt, productIds, bannerColor } = body;

  if (!title) return NextResponse.json({ error: 'Titel ist erforderlich' }, { status: 400 });

  const data = await loadProductsData();
  if (!data.promotions) data.promotions = [];

  const promo = {
    id: `promo-${Date.now()}`,
    title,
    description: description || '',
    active: true,
    expiresAt: expiresAt || '',
    productIds: productIds || [],
    bannerColor: bannerColor || '#6e8c8c',
  };

  data.promotions.push(promo);
  await saveProductsData(data);

  return NextResponse.json({ ok: true, promotion: promo });
}
