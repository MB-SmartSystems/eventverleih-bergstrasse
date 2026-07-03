// Baserow-Datenschicht fuer den oeffentlichen Produktkatalog + Admin.
//
// Ersetzt src/lib/blob-data.ts (Vercel Blob). IDENTISCHE Signaturen
// (loadProductsData / saveProductsData / uploadImage / deleteImage / ensureSeeded),
// damit die aufrufenden API-Routen weitgehend unveraendert bleiben.
//
// Quelle der Wahrheit:
//   - Produkte  -> Tabelle Artikel (957), DIESELBE Tabelle wie das Buchungssystem
//                  (KEIN Zweit-Katalog). Website-Felder: Beschreibung, Bild_URL,
//                  Bild_URLs_weitere, Youtube_Link, Pinned; Anzeigepreis == Mietpreis_WE_Eur.
//   - Kategorien / Promotions / Storefront-Settings -> System_Konfiguration (955),
//                  Key/Value: website.categories, website.promotions, website.whatsapp,
//                  website.instagram, website.hero_image; Telefon/Email aus den
//                  kanonischen Zeilen 'Telefon' / 'Email'.
//
// WICHTIG (Projekt-Playbook): KEIN stiller Leer-Fallback mehr. Baserow-Fehler
// werfen; die oeffentliche /api/products-Route mappt sie auf HTTP 503. Das stille
// Leerlaufen des alten Blob-Codes hatte die Store-Sperre wochenlang unsichtbar gemacht.

import type {
  ProductsData,
  RentalProduct,
  ProductCategory,
  Promotion,
  SiteSettings,
} from './types';
import {
  TABLES,
  listAllRows,
  createRow,
  updateRow,
  deleteRow,
  uploadUserFile,
} from './baserow/client';

const BASEROW_ROW = TABLES.Artikel;
const KONFIG = TABLES.System_Konfiguration;

const PRICE_UNIT = 'pro Miete (bis zu 5 Tage)';

// System_Konfiguration Key/Value-Schluessel.
const KEY = {
  categories: 'website.categories',
  promotions: 'website.promotions',
  whatsapp: 'website.whatsapp',
  instagram: 'website.instagram',
  heroImage: 'website.hero_image',
  telefon: 'Telefon',
  email: 'Email',
} as const;

// Website-Kategorie (Storefront-Slug) <- Baserow Artikel.Kategorie (9 Werte).
const CATEGORY_TO_SLUG: Record<string, string> = {
  Zelt: 'zelte',
  Zubehoer: 'zelte',
  Gewicht: 'zelte',
  Tisch: 'tische',
  Stuhl: 'tische',
  Beleuchtung: 'beleuchtung',
  Heizung: 'beleuchtung',
  Deko: 'deko',
  Spiel: 'deko',
};

// Default Baserow-Kategorie fuer eine Website-Kategorie (bei Neuanlage / echtem
// Kategorie-Wechsel). Feinere Baserow-Werte (Zubehoer/Gewicht/Stuhl/Heizung/Spiel)
// bleiben beim Bearbeiten erhalten, solange sich die Website-Kategorie nicht aendert.
const SLUG_TO_CATEGORY: Record<string, string> = {
  zelte: 'Zelt',
  tische: 'Tisch',
  beleuchtung: 'Beleuchtung',
  deko: 'Deko',
};

// --- Roh-Feld-Konverter -----------------------------------------------------

interface ArtikelRow {
  id: number;
  Artikel_ID: number;
  Bezeichnung: string | null;
  Slug: string | null;
  Kategorie: { value: string } | null;
  Mietpreis_WE_Eur: string | null;
  Aufbau_Pauschale_Eur: string | null;
  Kaution_Pro_Stueck_Eur: string | null;
  Bestand_OK: string | number | null;
  Bestand_Reparatur: string | number | null;
  Bestand_Defekt: string | number | null;
  Sichtbar_Public: boolean;
  Lager_Ort: string | null;
  Interne_Notizen: string | null;
  Bild_URL: string | null;
  Beschreibung: string | null;
  Bild_URLs_weitere: string | null;
  Youtube_Link: string | null;
  Pinned: boolean;
  [k: string]: unknown;
}

interface KonfigRow {
  id: number;
  Schluessel: string | null;
  Wert_Text: string | null;
  Wert_JSON: string | null;
  [k: string]: unknown;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOr0(v: unknown): number {
  const n = num(v);
  return n == null ? 0 : Math.max(0, Math.trunc(n));
}

function readSelect(v: { value: string } | null | undefined): string {
  return v && typeof v === 'object' && 'value' in v ? String(v.value ?? '') : '';
}

function parseJsonArray<T>(s: string | null | undefined, fallback: T[]): T[] {
  if (!s) return fallback;
  try {
    const p = JSON.parse(s);
    return Array.isArray(p) ? (p as T[]) : fallback;
  } catch {
    return fallback;
  }
}

// Mietpreis (number) -> Anzeige-String im bisherigen Format ("25 €" / "2,50 €").
function formatEuro(n: number | null): string {
  if (n == null) return '';
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`;
}

// Anzeige-/Formular-Preis-String -> number (fuer Mietpreis_WE_Eur beim Speichern).
function parseEuro(s: string | null | undefined): number | null {
  if (!s) return null;
  const cleaned = String(s).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `artikel-${Date.now()}`;
}

function rowToProduct(r: ArtikelRow): RentalProduct {
  const katValue = readSelect(r.Kategorie);
  const extra = parseJsonArray<string>(r.Bild_URLs_weitere, []);
  const images = [r.Bild_URL || '', ...extra].map((x) => String(x || '').trim()).filter(Boolean);
  const mietpreis = num(r.Mietpreis_WE_Eur);
  return {
    id: String(r.Artikel_ID),
    category: CATEGORY_TO_SLUG[katValue] || 'deko',
    images,
    image: images[0] || '',
    name: r.Bezeichnung || '',
    description: r.Beschreibung || undefined,
    price: formatEuro(mietpreis),
    priceUnit: PRICE_UNIT,
    youtubeLink: r.Youtube_Link || undefined,
    tags: [],
    visible: r.Sichtbar_Public === true,
    pinned: r.Pinned === true,
    quantityOk: intOr0(r.Bestand_OK),
    quantityRepair: intOr0(r.Bestand_Reparatur),
    quantityBroken: intOr0(r.Bestand_Defekt),
    location: r.Lager_Ort || undefined,
    internalNotes: r.Interne_Notizen || undefined,
    // Cart-/Buchungs-Pricing direkt aus der Artikel-Zeile (kein Name-Matching mehr noetig).
    mietpreisEur: mietpreis,
    kautionEur: num(r.Kaution_Pro_Stueck_Eur),
    aufbauEur: num(r.Aufbau_Pauschale_Eur),
    artikelId: r.Artikel_ID,
  };
}

// --- Laden ------------------------------------------------------------------

const DEFAULT_SETTINGS: SiteSettings = { phone: '', whatsapp: '', email: '', instagram: '' };

function konfigMaps(rows: KonfigRow[]): { text: Map<string, string>; json: Map<string, string> } {
  const text = new Map<string, string>();
  const json = new Map<string, string>();
  for (const r of rows) {
    const k = (r.Schluessel || '').trim();
    if (!k) continue;
    if (r.Wert_Text != null) text.set(k, String(r.Wert_Text));
    if (r.Wert_JSON != null) json.set(k, String(r.Wert_JSON));
  }
  return { text, json };
}

export async function loadProductsData(): Promise<ProductsData> {
  const [artikel, konfig] = await Promise.all([
    listAllRows<ArtikelRow>(BASEROW_ROW),
    listAllRows<KonfigRow>(KONFIG),
  ]);

  // Nur oeffentliche Artikel gehoeren in den Website-Katalog (Admin + Storefront).
  // Interne Buchungs-Artikel (Ratsche, Bodenanker, Gewebeplane, Klebeband, Kabelroller
  // = Sichtbar_Public:false) bleiben aussen vor. Die oeffentliche Route filtert
  // zusaetzlich visible; hier reicht Sichtbar_Public.
  const products = artikel.results
    .filter((r) => r.Sichtbar_Public === true)
    .map(rowToProduct);

  const { text, json } = konfigMaps(konfig.results);

  const categories = parseJsonArray<ProductCategory>(json.get(KEY.categories), []);
  const promotions = parseJsonArray<Promotion>(json.get(KEY.promotions), []);

  const phone = text.get(KEY.telefon) || '';
  const settings: SiteSettings = {
    phone,
    // WhatsApp = gleiche Nummer wie Telefon, sofern nicht separat gepflegt.
    whatsapp: text.get(KEY.whatsapp) || phone,
    email: text.get(KEY.email) || '',
    instagram: text.get(KEY.instagram) || '',
    heroImage: text.get(KEY.heroImage) || undefined,
  };

  // Auto-Expire abgelaufener Aktionen (Datums-Ebene, timezone-stabil).
  const today = new Date().toISOString().split('T')[0];
  for (const promo of promotions) {
    if (promo.active && promo.expiresAt && promo.expiresAt.split('T')[0] < today) {
      promo.active = false;
    }
  }

  return { categories, products, promotions, settings };
}

// --- Speichern (gezielter Diff, NICHT-destruktiv fuer Buchungssystem) --------

// Website-verwaltete Felder einer Artikel-Zeile aus einem Produkt bauen.
// Kategorie wird NUR gesetzt, wenn sich die Website-Kategorie tatsaechlich aendert
// (sonst bliebe der feinere Baserow-Wert erhalten) -> per Flag gesteuert.
function productToArtikelFields(p: RentalProduct, opts: { setCategory: boolean; forCreate: boolean }): Record<string, unknown> {
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : (p.image ? [p.image] : []);
  const fields: Record<string, unknown> = {
    Bezeichnung: p.name ?? '',
    Beschreibung: p.description ?? '',
    Bild_URL: images[0] ?? '',
    Bild_URLs_weitere: JSON.stringify(images.slice(1)),
    Youtube_Link: p.youtubeLink ?? '',
    Sichtbar_Public: p.visible !== false,
    Pinned: Boolean(p.pinned),
    Bestand_OK: intOr0(p.quantityOk),
    Bestand_Reparatur: intOr0(p.quantityRepair),
    Bestand_Defekt: intOr0(p.quantityBroken),
    Lager_Ort: p.location ?? '',
    Interne_Notizen: p.internalNotes ?? '',
  };
  // Admin-Preis ist ab jetzt die EINZIGE Quelle -> Mietpreis_WE_Eur mitschreiben,
  // aber nur wenn parsebar (nie den Buchungspreis auf null setzen).
  const priceNum = parseEuro(p.price);
  if (priceNum != null) fields.Mietpreis_WE_Eur = priceNum;

  if (opts.setCategory) {
    fields.Kategorie = SLUG_TO_CATEGORY[p.category] || 'Deko';
  }
  if (opts.forCreate) {
    fields.Slug = slugify(p.name || p.id);
    if (!opts.setCategory) fields.Kategorie = SLUG_TO_CATEGORY[p.category] || 'Deko';
  }
  return fields;
}

export async function saveProductsData(data: ProductsData): Promise<void> {
  const incoming = data.products || [];

  // Guardrail: nie alle sichtbaren Produkte loeschen, weil ein Lade-Fehler ein
  // leeres Array durchreichte (Schutz gegen versehentlichen Katalog-Wipe).
  const artikel = await listAllRows<ArtikelRow>(BASEROW_ROW);
  const visibleRows = artikel.results.filter((r) => r.Sichtbar_Public === true);
  if (incoming.length === 0 && visibleRows.length > 0) {
    throw new Error('saveProductsData blocked: refuses to wipe visible catalog with empty payload');
  }

  const byArtikelId = new Map<number, ArtikelRow>();
  for (const r of artikel.results) byArtikelId.set(r.Artikel_ID, r);

  const keptArtikelIds = new Set<number>();

  for (const p of incoming) {
    const aid = Number(p.artikelId ?? p.id);
    const existing = Number.isFinite(aid) ? byArtikelId.get(aid) : undefined;

    if (existing) {
      keptArtikelIds.add(existing.Artikel_ID);
      const currentSlug = CATEGORY_TO_SLUG[readSelect(existing.Kategorie)] || '';
      const categoryChanged = currentSlug !== p.category;
      const desired = productToArtikelFields(p, { setCategory: categoryChanged, forCreate: false });
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(desired)) {
        if (!artikelFieldEquals(existing[k], v)) patch[k] = v;
      }
      if (Object.keys(patch).length > 0) {
        await updateRow(BASEROW_ROW, existing.id, patch);
      }
    } else {
      // Neuer Artikel (Admin „Produkt hinzufuegen") -> POST. Artikel_ID vergibt Baserow (autonumber).
      const fields = productToArtikelFields(p, { setCategory: true, forCreate: true });
      await createRow(BASEROW_ROW, fields);
    }
  }

  // Loeschungen: sichtbare Artikel-Zeilen, die nicht mehr im Payload sind
  // (= im Admin geloescht). Interne (Sichtbar_Public:false) sind hier nie im Scope.
  for (const r of visibleRows) {
    if (!keptArtikelIds.has(r.Artikel_ID)) {
      await deleteRow(BASEROW_ROW, r.id);
    }
  }

  // Kategorien + Promotions als JSON in System_Konfiguration upserten.
  await upsertKonfigJson(KEY.categories, data.categories || []);
  await upsertKonfigJson(KEY.promotions, data.promotions || []);
  // Settings (Telefon/Email) bleiben kanonisch in ihren eigenen Zeilen — hier NICHT ueberschreiben.
}

// Vergleich Roh-Zellwert (Baserow) mit gewuenschtem Schreibwert -> unnoetige PATCHes vermeiden.
function artikelFieldEquals(existingRaw: unknown, desired: unknown): boolean {
  let a: unknown = existingRaw;
  if (a && typeof a === 'object' && 'value' in (a as object)) a = (a as { value: unknown }).value;
  if (a == null) a = '';
  let b: unknown = desired;
  if (b == null) b = '';
  if (typeof desired === 'boolean') return Boolean(a) === desired;
  if (typeof desired === 'number') return Number(a) === desired;
  return String(a) === String(b);
}

async function upsertKonfigJson(key: string, value: unknown): Promise<void> {
  const rows = await listAllRows<KonfigRow>(KONFIG);
  const existing = rows.results.find((r) => (r.Schluessel || '').trim() === key);
  const jsonStr = JSON.stringify(value ?? []);
  if (existing) {
    if (String(existing.Wert_JSON ?? '') !== jsonStr) {
      await updateRow(KONFIG, existing.id, { Wert_JSON: jsonStr });
    }
  } else {
    await createRow(KONFIG, { Schluessel: key, Wert_JSON: jsonStr });
  }
}

// --- Binaer-Uploads ---------------------------------------------------------

// Neu im Admin hochgeladene Bilder -> Baserow-User-File-Store (oeffentliche URL).
// Signatur identisch zur alten blob-data.ts (categorySlug jetzt nur informativ).
export async function uploadImage(file: Buffer, filename: string, _categorySlug: string): Promise<string> {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, '') || `bild-${Date.now()}.jpg`;
  const ct = clean.toLowerCase().endsWith('.png')
    ? 'image/png'
    : clean.toLowerCase().endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  return uploadUserFile(file, clean, ct);
}

// Baserow-User-Files haben keine Delete-API (GC serverseitig). Statische Repo-
// Bilder werden ebenfalls nicht zur Laufzeit geloescht. No-op, damit Aufrufer,
// die nach Entfernen der Referenz „aufraeumen", nicht brechen.
export async function deleteImage(_imageUrl: string): Promise<void> {
  /* no-op: siehe Kommentar */
}

// Baserow ist bereits befuellt — kein Seeding mehr noetig. No-op (Signatur bleibt,
// damit die oeffentliche Route unveraendert aufrufen kann).
export async function ensureSeeded(): Promise<void> {
  /* no-op: Katalog lebt in Baserow (Artikel 957) */
}
