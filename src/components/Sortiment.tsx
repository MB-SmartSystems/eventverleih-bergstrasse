"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCart } from "./CartContext";
import ProductLightbox from "./ProductLightbox";
import type { RentalProduct, ProductCategory, ProductsData } from "@/lib/types";
import { normalizeArtikelName as normalizeName, tokensMatch } from "@/lib/eventverleih/artikel-match";

type AvailabilityState = "available" | "unavailable" | "unknown" | "knapp";

interface AvailabilityEntry {
  available: boolean;
  restzahl: number;
  bestand_gesamt: number;
  /** Bestellbar-Artikel (Bestand 0, Bestand_Bestellbar=true): buchbar, Beschaffung nach Anfrage. */
  on_request?: boolean;
}

function ProductCard({
  product,
  onImageClick,
  availability,
  restzahl,
}: {
  product: RentalProduct;
  onImageClick: (images: string[], alt: string, startIndex: number) => void;
  availability: AvailabilityState;
  restzahl?: number;
}) {
  const { addItem, removeItem, getQuantity } = useCart();
  const qty = getQuantity(product.name);
  const thumb = product.images[0] || product.image;
  const hasMultiple = product.images.length > 1;
  const isUnavailable = availability === "unavailable";
  const isKnapp = availability === "knapp";

  return (
    <div
      className={`glass-card overflow-hidden group transition-all flex flex-col h-full ${
        qty > 0
          ? "border-gold-500/50 ring-1 ring-gold-500/20"
          : isUnavailable
          ? "opacity-60"
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
        <h4 className="font-semibold text-white text-lg mb-1 break-words">
          {product.name}
        </h4>
        {product.description && (
          <p className="text-gray-400 text-sm">{product.description}</p>
        )}
        {product.name.toLowerCase().includes("faltzelt") && (
          <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-gray-400">
            <svg className="w-3.5 h-3.5 mt-px flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>Nur auf ebenem, festem und waagerechtem Untergrund aufbauen — auf schiefem/unebenem Grund kann das Zelt beschädigt werden.</span>
          </p>
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-gold-400 text-2xl font-bold whitespace-nowrap">
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
            <>
              {isKnapp && (
                <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  Nur noch {restzahl} im Zeitraum
                </div>
              )}
              {isUnavailable && (
                <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  Im Zeitraum belegt
                </div>
              )}
              <button
                onClick={() => addItem(product.name, product.price)}
                disabled={isUnavailable}
                className={`w-full py-2 border text-sm font-medium rounded-lg transition-all ${
                  isUnavailable
                    ? "border-white/10 text-gray-500 cursor-not-allowed"
                    : "border-gold-500/30 text-gold-400 hover:bg-gold-500/10"
                }`}
              >
                {isUnavailable ? "Bitte anderen Termin wählen" : "+ Zum Warenkorb hinzufügen"}
              </button>
            </>
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

// Die Baserow-Kategorie (Zelt/Zubehoer/Gewicht/...) ist fuer die Website-Reihenfolge
// zu grob (z.B. haben Seitenwaende dieselbe Kategorie "Zelt" wie die Zelte selbst) ->
// Reihenfolge pro Website-Kategorie ueber Namens-Muster: Hauptartikel zuerst, danach
// Zubehoer/Verbrauchsmaterial, das zum Hauptartikel gehoert (Manuel, 2026-07-03:
// "sinnvoll sortieren" fuer Zelte; 2026-07-03 Folgefund fuer Tische + Beleuchtung:
// "Tischdecke erst nach Tisch, Gas erst nach Heizpilz").
function categoryContentPriority(categorySlug: string, name: string): number {
  const n = name.toLowerCase();
  if (categorySlug === "zelte") {
    if (n.includes("faltzelt")) return 0;
    if (n.includes("seitenwand")) return 1;
    if (n.includes("gewicht") || n.includes("bodenanker") || n.includes("ratsche")) return 2;
    return 3;
  }
  if (categorySlug === "tische") {
    if (n.includes("tischdecke")) return 2; // Zubehoer zum Tisch -> zuletzt
    if (n.includes("tisch")) return 0; // Klapptisch, Stehtisch
    if (n.includes("stuhl")) return 1;
    return 3;
  }
  if (categorySlug === "beleuchtung") {
    if (n.includes("gasflasche")) return 2; // Verbrauchsmaterial zum Heizstrahler -> danach
    if (n.includes("heizstrahler")) return 1;
    if (n.includes("licht")) return 0; // Lichterkette, Lichternetz
    return 3;
  }
  if (categorySlug === "deko") {
    // Manuel, 2026-07-03: "Riesenjenga, dann Hochzeitsbogen, dann Kamera, dann Film."
    if (n.includes("riesenjenga")) return 0;
    if (n.includes("hochzeitsbogen")) return 1;
    if (n.includes("sofortbildkamera")) return 2;
    if (n.includes("film")) return 3;
    return 4;
  }
  return 0;
}

export default function Sortiment() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState<
    { slides: { src: string; alt: string }[]; index: number } | null
  >(null);
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, AvailabilityEntry>>(new Map());
  const { rangeVon, rangeBis } = useCart();
  const von = rangeVon || "";
  const bis = rangeBis || "";
  const hasRange = Boolean(rangeVon && rangeBis);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d: ProductsData) => setData(d))
      .catch(() => setError(true));
  }, []);

  // Lade Verfügbarkeit wenn URL-Range gesetzt
  useEffect(() => {
    if (!hasRange) {
      setAvailabilityMap(new Map());
      return;
    }
    let cancelled = false;
    fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ von, bis }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { items?: Array<{ artikel_name: string; available: boolean; restzahl: number; bestand_gesamt: number; on_request?: boolean }> } | null) => {
        if (cancelled || !j?.items) return;
        const m = new Map<string, AvailabilityEntry>();
        for (const it of j.items) {
          if (it.artikel_name) {
            m.set(normalizeName(it.artikel_name), {
              available: it.available,
              restzahl: it.restzahl,
              bestand_gesamt: it.bestand_gesamt,
              on_request: it.on_request,
            });
          }
        }
        setAvailabilityMap(m);
      })
      .catch(() => {
        // still ok — keine Badges
      });
    return () => {
      cancelled = true;
    };
  }, [hasRange, von, bis]);

  const lookupEntry = (name: string): AvailabilityEntry | undefined => {
    if (!hasRange) return undefined;
    if (availabilityMap.size === 0) return undefined;
    const norm = normalizeName(name);
    // Exact match
    let val = availabilityMap.get(norm);
    if (val === undefined) {
      // Substring-Match in beide Richtungen
      availabilityMap.forEach((v, k) => {
        if (val !== undefined) return;
        if (k.includes(norm) || norm.includes(k)) {
          val = v;
        }
      });
    }
    if (val === undefined) {
      // Token-Sort-Match (Word-Order-tolerant, Plural/Singular)
      availabilityMap.forEach((v, k) => {
        if (val !== undefined) return;
        if (tokensMatch(k, norm)) {
          val = v;
        }
      });
    }
    return val;
  };

  const lookupAvailability = (name: string): { state: AvailabilityState; restzahl?: number } => {
    const entry = lookupEntry(name);
    if (entry === undefined) return { state: "unknown" };
    if (!entry.available) return { state: "unavailable", restzahl: 0 };
    // Bestellbare Artikel (on_request): nahtlos buchbar — kein "belegt"-/Knapp-Badge,
    // die Beschaffungs-Pruefung passiert backendseitig auf der Anfrage.
    if (entry.on_request) return { state: "available" };
    if (entry.restzahl === 0) return { state: "unavailable", restzahl: 0 };
    // Knapp: restzahl <= bestand_gesamt / 2
    if (entry.bestand_gesamt > 0 && entry.restzahl <= entry.bestand_gesamt / 2) {
      return { state: "knapp", restzahl: entry.restzahl };
    }
    return { state: "available", restzahl: entry.restzahl };
  };

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
            Eventverleih an der Bergstraße – unser Sortiment
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Beim Eventverleih Bergstraße mieten Sie Zelte, Tische, Stühle, Licht,
            Wärme und mehr für Ihr Fest in Alsbach-Hähnlein und der Region
            Rhein-Neckar — jeder Artikel mit klarem Mietpreis (pauschal, bis zu
            5 Tage), alles einzeln mietbar. Sets sind Startpunkte, keine Pflicht.
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
                .sort((a, b) => {
                  const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                  if (pinDiff !== 0) return pinDiff;
                  return (
                    categoryContentPriority(category.slug, a.name) -
                    categoryContentPriority(category.slug, b.name)
                  );
                });
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
                    {products.map((product) => {
                      const avail = lookupAvailability(product.name);
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onImageClick={handleImageClick}
                          availability={avail.state}
                          restzahl={avail.restzahl}
                        />
                      );
                    })}
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
