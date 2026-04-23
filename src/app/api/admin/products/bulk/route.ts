import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData, deleteImage } from '@/lib/blob-data';

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, productIds, category } = await request.json() as {
    action: 'hide' | 'show' | 'delete' | 'category';
    productIds: string[];
    category?: string;
  };

  if (!productIds || productIds.length === 0) {
    return NextResponse.json({ error: 'Keine Produkte ausgewaehlt' }, { status: 400 });
  }

  const data = await loadProductsData();

  if (action === 'hide') {
    for (const p of data.products) {
      if (productIds.includes(p.id)) p.visible = false;
    }
  } else if (action === 'show') {
    for (const p of data.products) {
      if (productIds.includes(p.id)) p.visible = true;
    }
  } else if (action === 'category') {
    if (!category) return NextResponse.json({ error: 'Keine Kategorie angegeben' }, { status: 400 });
    for (const p of data.products) {
      if (productIds.includes(p.id)) p.category = category;
    }
  } else if (action === 'delete') {
    const toDelete = data.products.filter(p => productIds.includes(p.id));
    for (const p of toDelete) {
      for (const url of (p.images || [p.image])) {
        await deleteImage(url);
      }
    }
    data.products = data.products.filter(p => !productIds.includes(p.id));
  }

  await saveProductsData(data);
  return NextResponse.json({ ok: true, affected: productIds.length });
}
