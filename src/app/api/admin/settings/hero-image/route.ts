import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData, uploadImage, deleteImage } from '@/lib/blob-data';

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const imageFile = formData.get('image') as File | null;
  if (!imageFile) return NextResponse.json({ error: 'Kein Bild hochgeladen' }, { status: 400 });

  const data = await loadProductsData();

  // Delete old hero image from blob if it exists and is a blob URL
  const oldImage = data.settings?.heroImage;
  if (oldImage && oldImage.includes('blob.vercel-storage.com')) {
    await deleteImage(oldImage);
  }

  // Upload new image
  const buffer = Buffer.from(await imageFile.arrayBuffer());
  const filename = `hero-${Date.now()}.webp`;
  const imageUrl = await uploadImage(buffer, filename, 'titelbild');

  data.settings = { ...data.settings, heroImage: imageUrl };
  await saveProductsData(data);

  return NextResponse.json({ ok: true, heroImage: imageUrl });
}
