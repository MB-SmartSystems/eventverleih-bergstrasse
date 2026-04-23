"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCart } from "./CartContext";
import ProductLightbox from "./ProductLightbox";
import type { RentalProduct, ProductCategory, ProductsData } from "@/lib/types";

function ProductCard({
  product,
  onImageClick,
}: {
  product: RentalProduct;
  onImageClick: (images: string[], alt: string, startIndex: number) => void;
}) {
  const { addItem, removeItem, getQuantity } = useCart();
  const qty = getQuantity(product.name);
  const thumb = product.images[0] || product.image;
  const hasMultiple = product.images.length > 1;

  return (
    <div
      className={`glass-card overflow-hidden group transition-all flex flex-col h-full ${
        qty > 0
          ? "border-gold-500/50 ring-1 ring-gold-500/20"
          : "hover:border-gold-500/30"
      }`}
    >
      <button
        type="button"
        onClick={() => onImageClick(product.images, product.name, 0)}
        className="relative aspect-square bg-navy-700 w-full block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        aria-label={`${product.name} vergrößern`}
      >
        <Image
          src={thumb}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {hasMultiple && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-navy-900/70 text-white text-[11px] font-medium">
            1/{product.images.length}
          </div>
        )}
        {qty > 0 && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gold-500 text-navy-900 font-bold text-sm flex items-center justify-center">
            {qty}
          </div>
        )}
      </button>
      <div className="p-4 md:p-5 flex flex-col flex-1">
        <h4 className="font-semibold text-white text-lg mb-1">
          {product.name}
        </h4>
        {product.description && (
          <p className="text-gray-400 text-sm">{product.description}</p>
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-gold-400 text-2xl font-bold">
              {product.price}
            </span>
            <span className="text-gray-500 text-xs">{product.priceUnit}</span>
          </div>

          {product.youtubeLink && (
            <a
              href={product.youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-400 text-sm mb-3 hover:text-gold-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Aufbauanleitung
            </a>
          )}

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
        </div>
      </div>
    </div>
  );
}

export default function Sortiment() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState<
    { slides: { src: string; alt: string }[]; index: number } | null
  >(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d: ProductsData) => setData(d))
      .catch(() => setError(true));
  }, []);

  const handleImageClick = (images: string[], alt: string, startIndex: number) => {
    setLightbox({
      slides: images.map((src) => ({ src, alt })),
      index: startIndex,
    });
  };

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

        {error && (
          <div className="text-center text-red-400 py-12">
            Sortiment konnte nicht geladen werden. Bitte Seite neu laden.
          </div>
        )}

        {!error && !data && (
          <div className="text-center text-gray-400 py-12">
            Laden...
          </div>
        )}

        {data &&
          [...data.categories]
            .sort((a, b) => a.order - b.order)
            .map((category: ProductCategory) => {
              const products = data.products
                .filter((p) => p.visible !== false && p.category === category.slug)
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
              if (products.length === 0) return null;
              return (
                <div key={category.slug} id={category.slug} className="mb-16 last:mb-0">
                  <div className="flex items-center gap-4 mb-8">
                    <h3 className="font-display text-2xl font-semibold text-white">
                      {category.name}
                    </h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onImageClick={handleImageClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
      </div>

      <ProductLightbox
        open={!!lightbox}
        slides={lightbox?.slides ?? []}
        index={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onIndexChange={(i) =>
          setLightbox((prev) => (prev ? { ...prev, index: i } : prev))
        }
      />
    </section>
  );
}
