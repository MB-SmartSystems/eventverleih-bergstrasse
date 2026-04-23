import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData, uploadImage, deleteImage } from '@/lib/blob-data';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const name = formData.get('name') as string | null;
  const category = formData.get('category') as string | null;
  const tags = formData.get('tags') as string | null;
  const price = formData.get('price') as string | null;
  const priceUnit = formData.get('priceUnit') as string | null;
  const description = formData.get('description') as string | null;
  const youtubeLink = formData.get('youtubeLink') as string | null;

  // Multi-image handling
  const existingImagesStr = formData.get('existingImages') as string | null;
  const removeImagesStr = formData.get('removeImages') as string | null;
  const newImageFiles = formData.getAll('newImages') as File[];

  const data = await loadProductsData();
  const product = data.products.find(p => p.id === params.id);
  if (!product) return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });

  if (name) product.name = name;
  if (category) product.category = category;
  if (tags !== null) product.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (price !== null) product.price = price;
  if (priceUnit !== null) product.priceUnit = priceUnit;
  if (description !== null) product.description = description || undefined;
  if (youtubeLink !== null) product.youtubeLink = youtubeLink || undefined;

  const visibleStr = formData.get('visible') as string | null;
  const pinnedStr = formData.get('pinned') as string | null;
  if (visibleStr !== null) product.visible = visibleStr === 'true';
  if (pinnedStr !== null) product.pinned = pinnedStr === 'true';

  const existingImages: string[] = existingImagesStr ? JSON.parse(existingImagesStr) : product.images || [product.image];
  const removeImages: string[] = removeImagesStr ? JSON.parse(removeImagesStr) : [];

  // Delete removed images from blob
  for (const url of removeImages) {
    await deleteImage(url);
  }

  // Filter out removed from existing
  let images = existingImages.filter(url => !removeImages.includes(url));

  // Upload new images
  for (const file of newImageFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const url = await uploadImage(buffer, filename, product.category);
    images.push(url);
  }

  if (images.length > 0) {
    product.images = images;
    product.image = images[0];
  }

  await saveProductsData(data);
  return NextResponse.json({ ok: true, product });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await loadProductsData();
  const product = data.products.find(p => p.id === params.id);
  if (!product) return NextResponse.json({ error: 'Produkt nicht gefunden' }, { status: 404 });

  // Delete all images
  for (const url of (product.images || [product.image])) {
    await deleteImage(url);
  }
  data.products = data.products.filter(p => p.id !== params.id);
  await saveProductsData(data);

  return NextResponse.json({ ok: true });
}
