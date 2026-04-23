import { put, del, list, head } from '@vercel/blob';
import type { ProductsData } from './types';
import { SEED_DATA } from './seed-data';

const PRODUCTS_JSON = 'products.json';

// Cache the blob URL to avoid list() eventual consistency issues
let cachedBlobUrl: string | null = null;

async function getProductsBlobUrl(): Promise<string | null> {
  if (cachedBlobUrl) {
    try {
      await head(cachedBlobUrl);
      return cachedBlobUrl;
    } catch {
      cachedBlobUrl = null;
    }
  }
  const blobs = await list({ prefix: PRODUCTS_JSON });
  const match = blobs.blobs.find(b => b.pathname === PRODUCTS_JSON);
  if (match) {
    cachedBlobUrl = match.url;
    return match.url;
  }
  return null;
}

export async function loadProductsData(): Promise<ProductsData> {
  try {
    const url = await getProductsBlobUrl();
    if (!url) return { categories: [], products: [], promotions: [], settings: { phone: '', whatsapp: '', email: '', instagram: '' } };
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    // Normalize: ensure images array exists and image points to first
    for (const p of data.products) {
      if (!p.images || !Array.isArray(p.images)) {
        p.images = p.image ? [p.image] : [];
      }
      p.image = p.images[0] || '';
      if (p.visible === undefined) p.visible = true;
      if (p.pinned === undefined) p.pinned = false;
    }

    // Normalize promotions and settings
    if (!data.promotions) data.promotions = [];
    if (!data.settings) data.settings = { phone: '', whatsapp: '', email: '', instagram: '' };

    // Auto-expire promotions (compare date-only to avoid timezone edge cases)
    const today = new Date().toISOString().split('T')[0];
    for (const promo of data.promotions) {
      if (promo.active && promo.expiresAt && promo.expiresAt.split('T')[0] < today) {
        promo.active = false;
      }
    }

    return data;
  } catch {
    return { categories: [], products: [], promotions: [], settings: { phone: '', whatsapp: '', email: '', instagram: '' } };
  }
}

export async function saveProductsData(data: ProductsData): Promise<void> {
  // Delete old blob(s)
  try {
    const blobs = await list({ prefix: PRODUCTS_JSON });
    for (const blob of blobs.blobs) {
      if (blob.pathname === PRODUCTS_JSON) {
        await del(blob.url);
      }
    }
  } catch { /* ignore */ }

  // Write new blob — addRandomSuffix: false for deterministic URL
  const blob = await put(PRODUCTS_JSON, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  cachedBlobUrl = blob.url;
}

export async function uploadImage(
  file: Buffer,
  filename: string,
  categorySlug: string
): Promise<string> {
  const pathname = `produkte/${categorySlug}/${filename}`;
  const blob = await put(pathname, file, {
    access: 'public',
    contentType: 'image/webp',
  });
  return blob.url;
}

export async function ensureSeeded(): Promise<void> {
  const url = await getProductsBlobUrl();
  if (url) return;
  await saveProductsData(SEED_DATA);
}

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    await del(imageUrl);
  } catch { /* image may already be deleted */ }
}
