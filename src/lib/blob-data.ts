import { put, del, list } from '@vercel/blob';
import type { ProductsData } from './types';
import { SEED_DATA } from './seed-data';

const PRODUCTS_JSON = 'products.json';

/**
 * Resolve the blob URL fresh on every call. Module-level caching of the URL
 * was the root cause of multiple zero-data incidents: a function instance
 * could hold a stale/dead URL across invocations, return the catch-block
 * fallback (= EMPTY_DATA) to the admin UI, the admin would then save that
 * empty state back and wipe the catalog.
 *
 * Trade-off: one extra list() call per load (~80-150ms). Worth it.
 */
async function resolveBlobUrl(): Promise<string | null> {
  const blobs = await list({ prefix: PRODUCTS_JSON });
  const match = blobs.blobs.find((b) => b.pathname === PRODUCTS_JSON);
  return match ? match.url : null;
}

async function fetchAndParse(url: string): Promise<ProductsData> {
  // Cache-bust via query param — `cache: 'no-store'` alone is insufficient
  // when Vercel Edge aggressively caches the blob-storage response.
  const bustedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(bustedUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Blob fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as ProductsData;
  if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
    throw new Error('Blob content has unexpected shape');
  }
  return data;
}

function cloneEmpty(): ProductsData {
  return {
    categories: [],
    products: [],
    promotions: [],
    settings: { phone: '', whatsapp: '', email: '', instagram: '' },
  };
}

export async function loadProductsData(): Promise<ProductsData> {
  let data: ProductsData;
  try {
    const url = await resolveBlobUrl();
    if (!url) return cloneEmpty();
    data = await fetchAndParse(url);
  } catch {
    return cloneEmpty();
  }

  // Normalize arrays
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

    // Backward-compat: old format (quantity + condition) → three-counter model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = p as any;
    const hasNewFields =
      p.quantityOk !== undefined ||
      p.quantityRepair !== undefined ||
      p.quantityBroken !== undefined;
    if (!hasNewFields) {
      const legacyQty = typeof legacy.quantity === 'number' ? legacy.quantity : 1;
      const legacyCond: string = legacy.condition || 'ok';
      p.quantityOk = legacyCond === 'ok' ? legacyQty : 0;
      p.quantityRepair = legacyCond === 'repair' ? legacyQty : 0;
      p.quantityBroken = legacyCond === 'broken' ? legacyQty : 0;
    } else {
      if (typeof p.quantityOk !== 'number' || p.quantityOk < 0) p.quantityOk = 0;
      if (typeof p.quantityRepair !== 'number' || p.quantityRepair < 0) p.quantityRepair = 0;
      if (typeof p.quantityBroken !== 'number' || p.quantityBroken < 0) p.quantityBroken = 0;
    }
    delete legacy.quantity;
    delete legacy.condition;
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
  // Guardrail: never persist a fully empty state — always indicates a load-
  // before-save bug (stale cache / fetch failure bubbled up as EMPTY_DATA).
  if (data.products.length === 0 && data.categories.length === 0) {
    throw new Error('Refusing to save empty ProductsData — probable load-before-save bug');
  }

  // Deterministic URL: same pathname overwrites previous content.
  // addRandomSuffix: false + allowOverwrite: true is required since @vercel/blob v2.
  await put(PRODUCTS_JSON, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });

  // Cleanup: with deterministic URL there should be no duplicates, but legacy
  // random-suffix copies may exist. Defensive sweep — keep the newest only.
  try {
    const blobs = await list({ prefix: PRODUCTS_JSON });
    if (blobs.blobs.length > 1) {
      const sorted = [...blobs.blobs].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      );
      for (const extra of sorted.slice(1)) {
        if (extra.pathname === PRODUCTS_JSON) {
          await del(extra.url);
        }
      }
    }
  } catch {
    /* cleanup is best-effort */
  }
}

export async function uploadImage(
  file: Buffer,
  filename: string,
  categorySlug: string,
): Promise<string> {
  const pathname = `produkte/${categorySlug}/${filename}`;
  const blob = await put(pathname, file, {
    access: 'public',
    contentType: 'image/webp',
  });
  return blob.url;
}

export async function ensureSeeded(): Promise<void> {
  try {
    const url = await resolveBlobUrl();
    if (url) {
      try {
        const data = await fetchAndParse(url);
        if (data.products && data.products.length > 0) return;
      } catch {
        // Blob exists but unreadable — fall through to reseed
      }
    }
  } catch {
    // list() failed — fall through to reseed
  }
  await saveProductsData(SEED_DATA);
}

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    await del(imageUrl);
  } catch {
    /* image may already be deleted */
  }
}
