export interface RentalProduct {
  id: string;
  category: string;
  images: string[];
  image: string;
  name: string;
  description?: string;
  price: string;
  priceUnit: string;
  youtubeLink?: string;
  tags: string[];
  visible: boolean;
  pinned: boolean;
  quantity: number;
  condition: 'ok' | 'repair' | 'broken';
  location?: string;
  internalNotes?: string;
}

export interface ProductCategory {
  slug: string;
  name: string;
  order: number;
  icon?: string;
  description?: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  active: boolean;
  expiresAt: string;
  productIds: string[];
  bannerColor: string;
}

export interface SiteSettings {
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  heroImage?: string;
}

export interface ProductsData {
  categories: ProductCategory[];
  products: RentalProduct[];
  promotions: Promotion[];
  settings: SiteSettings;
}

export type GalleryProduct = RentalProduct;
