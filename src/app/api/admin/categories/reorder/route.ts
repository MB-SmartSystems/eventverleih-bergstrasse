import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export async function PUT(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slugs } = await request.json() as { slugs: string[] };
  const data = await loadProductsData();

  slugs.forEach((slug, i) => {
    const cat = data.categories.find(c => c.slug === slug);
    if (cat) cat.order = i + 1;
  });

  data.categories.sort((a, b) => a.order - b.order);
  await saveProductsData(data);
  return NextResponse.json({ ok: true });
}
