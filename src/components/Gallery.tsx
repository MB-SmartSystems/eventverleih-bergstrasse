"use client";

import { useState } from "react";
import Image from "next/image";
import ProductLightbox from "./ProductLightbox";

const images = [
  {
    src: "/images/gallery/partyzelt-nacht-gedeckte-tafel-lichterketten.jpg",
    alt: "Weißes Partyzelt bei Nacht mit langer gedeckter Tafel und Lichterketten",
  },
  {
    src: "/images/gallery/festtafel-weisse-stuehle-tischdecken.jpg",
    alt: "Lange Festtafel mit weißen Stühlen unter einem Zelt",
  },
  {
    src: "/images/gallery/partyzelt-lichter-fenstersektionen-nacht.jpg",
    alt: "Weißes Partyzelt mit Lichtern bei Nacht",
  },
  {
    src: "/images/gallery/partyzelt-tisch-acht-stuehle-terrasse.jpg",
    alt: "Partyzelt mit Tisch und Stühlen auf gepflasterter Terrasse",
  },
  {
    src: "/images/gallery/festzelt-festlich-gedeckte-tafel-pflanzen.jpg",
    alt: "Festzelt mit festlich gedeckter Tafel und Pflanzen",
  },
  {
    src: "/images/gallery/faltpavillon-seitenwaende-tischdecke.jpg",
    alt: "Faltpavillon mit Tisch und Klappstühlen",
  },
];

export default function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <section className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="text-center mb-12">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Impressionen
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Unsere Ausstattung im Einsatz
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="relative aspect-[4/3] rounded-xl overflow-hidden group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              aria-label={`${img.alt} vergrößern`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-navy-900/20 group-hover:bg-navy-900/0 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      <ProductLightbox
        open={lightboxIndex !== null}
        slides={images}
        index={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={(i) => setLightboxIndex(i)}
      />
    </section>
  );
}
