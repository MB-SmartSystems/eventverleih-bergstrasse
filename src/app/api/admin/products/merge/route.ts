import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { loadProductsData, saveProductsData } from '@/lib/blob-data';

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mainProductId, mergeProductIds } = await request.json() as {
    mainProductId: string;
    mergeProductIds: string[];
  };

  if (!mainProductId || !mergeProductIds || mergeProductIds.length === 0) {
    return NextResponse.json({ error: 'Hauptprodukt und mindestens ein weiteres Produkt erforderlich' }, { status: 400 });
  }

  const data = await loadProductsData();
  const mainProduct = data.products.find(p => p.id === mainProductId);
  if (!mainProduct) return NextResponse.json({ error: 'Hauptprodukt nicht gefunden' }, { status: 404 });

  // Collect all images from merge products
  const additionalImages: string[] = [];
  for (const id of mergeProductIds) {
    const product = data.products.find(p => p.id === id);
    if (product) {
      const imgs = product.images || (product.image ? [product.image] : []);
      additionalImages.push(...imgs);
    }
  }

  // Add images to main product
  const currentImages = mainProduct.images || (mainProduct.image ? [mainProduct.image] : []);
  mainProduct.images = [...currentImages, ...additionalImages];
  mainProduct.image = mainProduct.images[0] || '';

  // Remove merged products (don't delete their blob images — they're now on main product)
  data.products = data.products.filter(p => !mergeProductIds.includes(p.id));

  await saveProductsData(data);

  return NextResponse.json({
    ok: true,
    product: mainProduct,
    merged: mergeProductIds.length,
    totalImages: mainProduct.images.length,
  });
}
