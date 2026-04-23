import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await loadProductsData();
  return NextResponse.json({ settings: data.settings || {} });
}

export async function PUT(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const data = await loadProductsData();

  data.settings = {
    phone: body.phone ?? data.settings?.phone ?? '',
    whatsapp: body.whatsapp ?? data.settings?.whatsapp ?? '',
    email: body.email ?? data.settings?.email ?? '',
    instagram: body.instagram ?? data.settings?.instagram ?? '',
  };

  await saveProductsData(data);
  return NextResponse.json({ ok: true, settings: data.settings });
}
