import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, slug, icon, description } = await request.json();
  if (!name || !slug) return NextResponse.json({ error: 'Name und Slug sind Pflichtfelder' }, { status: 400 });

  const data = await loadProductsData();
  if (data.categories.find(c => c.slug === slug)) {
    return NextResponse.json({ error: 'Kategorie mit diesem Slug existiert bereits' }, { status: 409 });
  }

  const maxOrder = Math.max(0, ...data.categories.map(c => c.order));
  data.categories.push({ slug, name, description: description || '', icon: icon || '', order: maxOrder + 1 });
  await saveProductsData(data);

  return NextResponse.json({ ok: true });
}
