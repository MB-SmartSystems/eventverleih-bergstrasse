import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';
import { SEED_DATA } from '@/lib/seed-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await loadProductsData();
  if (existing.products.length > 0) {
    return NextResponse.json({ error: 'Daten bereits migriert', count: existing.products.length }, { status: 409 });
  }

  await saveProductsData(SEED_DATA);

  return NextResponse.json({
    ok: true,
    migrated: SEED_DATA.products.length,
    categories: SEED_DATA.categories.length,
  });
}
