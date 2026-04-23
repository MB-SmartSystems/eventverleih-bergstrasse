import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const updates = await request.json();
  const data = await loadProductsData();
  const cat = data.categories.find(c => c.slug === params.slug);
  if (!cat) return NextResponse.json({ error: 'Kategorie nicht gefunden' }, { status: 404 });

  if (updates.name) cat.name = updates.name;
  if (updates.icon !== undefined) cat.icon = updates.icon;
  if (updates.description !== undefined) cat.description = updates.description;

  await saveProductsData(data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: { slug: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await loadProductsData();
  const productCount = data.products.filter(p => p.category === params.slug).length;
  if (productCount > 0) {
    return NextResponse.json({ error: `Kategorie enthaelt noch ${productCount} Produkte` }, { status: 409 });
  }

  data.categories = data.categories.filter(c => c.slug !== params.slug);
  await saveProductsData(data);
  return NextResponse.json({ ok: true });
}
