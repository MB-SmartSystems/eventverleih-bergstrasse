"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "./CartContext";
import ProductLightbox from "./ProductLightbox";

interface Product {
  name: string;
  description?: string;
  image: string;
  price: string;
  priceUnit: string;
  youtubeLink?: string;
}

interface Category {
  id: string;
  title: string;
  products: Product[];
}

const categories: Category[] = [
  {
    id: "zelte",
    title: "Zelte & Zubehör",
    products: [
      {
        name: "Faltzelt 3×3 m",
        description: "Platz für bis zu 12 Personen",
        image: "/images/products/faltzelt-3x3.jpg",
        price: "25 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
        youtubeLink: "https://youtu.be/3CsNV8e3tOw",
      },
      {
        name: "Faltzelt 3×6 m",
        description: "Platz für bis zu 24 Personen",
        image: "/images/products/faltzelt-3x6.jpg",
        price: "42 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Seitenwand mit Fenster",
        image: "/images/products/seitenwand-fenster.jpg",
        price: "2 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Seitenwand mit Reißverschluss",
        image: "/images/products/seitenwand-reissverschluss-aussen.jpg",
        price: "2 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Gewicht — Metallplatte",
        image: "/images/products/gewicht-metallplatte.jpg",
        price: "2 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Gewicht — Wasser",
        image: "/images/products/gewicht-wasser.jpg",
        price: "2 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Bodenanker & Ratsche",
        image: "/images/products/bodenanker.jpg",
        price: "4 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
    ],
  },
  {
    id: "tische",
    title: "Tische & Stühle",
    products: [
      {
        name: "Tisch",
        description: "Platz für bis zu 8 Personen",
        image: "/images/products/klapptisch.jpg",
        price: "12 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Stuhl",
        image: "/images/products/klappstuhl.jpg",
        price: "2,50 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Tischdecke",
        description: "inkl. Reinigung",
        image: "/images/products/tischdecke.jpg",
        price: "4,50 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
    ],
  },
  {
    id: "beleuchtung",
    title: "Beleuchtung & Heizung",
    products: [
      {
        name: "Lichterkette 18 m",
        image: "/images/products/lichterkette.jpg",
        price: "8 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Heizstrahler",
        description: "ohne Gasflasche; 11 kg Gas reichen für ca. 8 Std.",
        image: "/images/products/heizstrahler.jpg",
        price: "25 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Gasflasche",
        image: "/images/products/gasflasche.jpg",
        price: "3 €",
        priceUnit: "pro kg",
      },
    ],
  },
  {
    id: "deko",
    title: "Dekoartikel & Spiele",
    products: [
      {
        name: "Hochzeitsbogen inkl. Abdeckung",
        description: "Breite × Höhe: 1,2 m × 2,2 m",
        image: "/images/products/hochzeitsbogen.jpg",
        price: "13 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
      {
        name: "Riesenjenga",
        description: "bis 1,50 m hoch stapelbar",
        image: "/images/products/riesenjenga.jpg",
        price: "15,50 €",
        priceUnit: "pro Miete (bis zu 5 Tage)",
      },
    ],
  },
];

function ProductCard({
  product,
  onImageClick,
}: {
  product: Product;
  onImageClick: (src: string, alt: string) => void;
}) {
  const { addItem, removeItem, getQuantity } = useCart();
  const qty = getQuantity(product.name);

  return (
    <div
      className={`glass-card overflow-hidden group transition-all ${
        qty > 0
          ? "border-gold-500/50 ring-1 ring-gold-500/20"
          : "hover:border-gold-500/30"
      }`}
    >
      <button
        type="button"
        onClick={() => onImageClick(product.image, product.name)}
        className="relative aspect-square bg-navy-700 w-full block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        aria-label={`${product.name} vergrößern`}
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {qty > 0 && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gold-500 text-navy-900 font-bold text-sm flex items-center justify-center">
            {qty}
          </div>
        )}
      </button>
      <div className="p-4 md:p-5">
        <h4 className="font-semibold text-white text-lg mb-1">
          {product.name}
        </h4>
        {product.description && (
          <p className="text-gray-400 text-sm mb-3">{product.description}</p>
        )}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-gold-400 text-2xl font-bold">
            {product.price}
          </span>
          <span className="text-gray-500 text-xs">{product.priceUnit}</span>
        </div>

        {/* Quantity Controls */}
        {qty === 0 ? (
          <button
            onClick={() => addItem(product.name, product.price)}
            className="w-full py-2 border border-gold-500/30 text-gold-400 text-sm font-medium rounded-lg hover:bg-gold-500/10 transition-all"
          >
            + Zur Anfrage hinzufügen
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => removeItem(product.name)}
              className="w-9 h-9 rounded-lg border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white font-semibold text-lg">{qty}</span>
            <button
              onClick={() => addItem(product.name, product.price)}
              className="w-9 h-9 rounded-lg bg-gold-500 text-navy-900 flex items-center justify-center hover:bg-gold-400 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}

        {product.youtubeLink && (
          <a
            href={product.youtubeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-gold-400 text-sm mt-3 hover:text-gold-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Aufbauanleitung
          </a>
        )}
      </div>
    </div>
  );
}

export default function Sortiment() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );

  return (
    <section id="sortiment" className="section-padding">
      <div className="container-width">
        <div className="text-center mb-16">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Was wir anbieten
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Unser Sortiment
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Zelte, Tische, Stühle, Beleuchtung, Heizung und Zubehör —
            funktional, verlässlich und für Feste jeder Art geeignet.
          </p>
        </div>

        {categories.map((category) => (
          <div key={category.id} id={category.id} className="mb-16 last:mb-0">
            <div className="flex items-center gap-4 mb-8">
              <h3 className="font-display text-2xl font-semibold text-white">
                {category.title}
              </h3>
              <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {category.products.map((product) => (
                <ProductCard
                  key={product.name}
                  product={product}
                  onImageClick={(src, alt) => setLightbox({ src, alt })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <ProductLightbox
        open={!!lightbox}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt ?? ""}
        onClose={() => setLightbox(null)}
      />
    </section>
  );
}
