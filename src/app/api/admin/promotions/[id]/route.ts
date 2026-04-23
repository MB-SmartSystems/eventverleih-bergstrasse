import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const data = await loadProductsData();
  const promo = (data.promotions || []).find(p => p.id === params.id);
  if (!promo) return NextResponse.json({ error: 'Aktion nicht gefunden' }, { status: 404 });

  if (body.title !== undefined) promo.title = body.title;
  if (body.description !== undefined) promo.description = body.description;
  if (body.active !== undefined) promo.active = body.active;
  if (body.expiresAt !== undefined) promo.expiresAt = body.expiresAt;
  if (body.productIds !== undefined) promo.productIds = body.productIds;
  if (body.bannerColor !== undefined) promo.bannerColor = body.bannerColor;

  await saveProductsData(data);
  return NextResponse.json({ ok: true, promotion: promo });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await loadProductsData();
  data.promotions = (data.promotions || []).filter(p => p.id !== params.id);
  await saveProductsData(data);

  return NextResponse.json({ ok: true });
}
