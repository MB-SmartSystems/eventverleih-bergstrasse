import { put, del, list, head } from '@vercel/blob';
import type { ProductsData } from './types';
import { SEED_DATA } from './seed-data';

const PRODUCTS_JSON = 'products.json';
const EMPTY_DATA: ProductsData = {
  categories: [],
  products: [],
  promotions: [],
  settings: { phone: '', whatsapp: '', email: '', instagram: '' },
};

// Cache the blob URL to avoid list() eventual consistency issues
let cachedBlobUrl: string | null = null;

function invalidateCache() {
  cachedBlobUrl = null;
}

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

async function fetchAndParse(url: string): Promise<ProductsData> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Blob fetch failed: HTTP ${res.status}`);
  return (await res.json()) as ProductsData;
}

export async function loadProductsData(): Promise<ProductsData> {
  let data: ProductsData | null = null;
  try {
    const url = await getProductsBlobUrl();
    if (!url) return EMPTY_DATA;
    try {
      data = await fetchAndParse(url);
    } catch {
      // Stale cache — invalidate and retry ONCE with a fresh list()
      invalidateCache();
      const retryUrl = await getProductsBlobUrl();
      if (!retryUrl) return EMPTY_DATA;
      data = await fetchAndParse(retryUrl);
    }
  } catch {
    // Both attempts failed — blob unreachable or corrupted
    invalidateCache();
    return EMPTY_DATA;
  }

  // Normalize
  if (!Array.isArray(data.products)) data.products = [];
  if (!Array.isArray(data.categories)) data.categories = [];
  if (!Array.isArray(data.promotions)) data.promotions = [];
  if (!data.settings) data.settings = { phone: '', whatsapp: '', email: '', instagram: '' };

  for (const p of data.products) {
    if (!p.images || !Array.isArray(p.images)) {
      p.images = p.image ? [p.image] : [];
    }
    p.image = p.images[0] || '';
    if (p.visible === undefined) p.visible = true;
    if (p.pinned === undefined) p.pinned = false;
    if (p.quantity === undefined || p.quantity === null) p.quantity = 1;
    if (!p.condition) p.condition = 'ok';
  }

  // Auto-expire promotions
  const today = new Date().toISOString().split('T')[0];
  for (const promo of data.promotions) {
    if (promo.active && promo.expiresAt && promo.expiresAt.split('T')[0] < today) {
      promo.active = false;
    }
  }

  return data;
}

export async function saveProductsData(data: ProductsData): Promise<void> {
  // Guardrail: never persist a completely empty state — indicates a caller bug
  // (most likely loadProductsData returned EMPTY_DATA due to a transient error).
  // Without this, a race condition during save can wipe the entire catalog.
  if (data.products.length === 0 && data.categories.length === 0) {
    throw new Error('Refusing to save empty ProductsData — probable load-before-save bug');
  }

  // 1) Write new blob first (deterministic URL — overwrites existing)
  const blob = await put(PRODUCTS_JSON, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  cachedBlobUrl = blob.url;

  // 2) Clean up any stray duplicate blobs with the same pathname but different URL
  // (shouldn't exist with addRandomSuffix:false, but safety net for legacy state)
  try {
    const blobs = await list({ prefix: PRODUCTS_JSON });
    for (const b of blobs.blobs) {
      if (b.pathname === PRODUCTS_JSON && b.url !== blob.url) {
        await del(b.url);
      }
    }
  } catch { /* ignore cleanup errors */ }
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
  if (url) {
    // Blob exists — check content isn't empty (edge case from past bugs)
    try {
      const data = await fetchAndParse(url);
      if (data.products && data.products.length > 0) return;
    } catch {
      invalidateCache();
    }
  }
  await saveProductsData(SEED_DATA);
}

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    await del(imageUrl);
  } catch { /* image may already be deleted */ }
}
