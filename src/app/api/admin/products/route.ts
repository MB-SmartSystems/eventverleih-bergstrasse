import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData, uploadImage } from '@/lib/blob-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await loadProductsData();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const imageFiles = formData.getAll('images') as File[];
  const name = formData.get('name') as string;
  const category = formData.get('category') as string;
  const price = (formData.get('price') as string) || '';
  const priceUnit = (formData.get('priceUnit') as string) || '';
  const description = (formData.get('description') as string) || undefined;
  const youtubeLink = (formData.get('youtubeLink') as string) || undefined;
  const tags = (formData.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean);

  if (!imageFiles.length || !name || !category) {
    return NextResponse.json({ error: 'Bild, Name und Kategorie sind Pflichtfelder' }, { status: 400 });
  }

  const images: string[] = [];
  for (const imageFile of imageFiles) {
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const filename = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const imageUrl = await uploadImage(buffer, filename, category);
    images.push(imageUrl);
  }

  const data = await loadProductsData();
  const product = {
    id: `p-${Date.now()}`,
    category,
    images,
    image: images[0],
    name,
    description,
    price,
    priceUnit,
    youtubeLink,
    tags,
    visible: true,
    pinned: false,
  };
  data.products.push(product);
  await saveProductsData(data);

  return NextResponse.json({ ok: true, product });
}
