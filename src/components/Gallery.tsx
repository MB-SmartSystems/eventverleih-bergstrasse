"use client";

import { useState } from "react";
import Image from "next/image";
import ProductLightbox from "./ProductLightbox";

// Caption-Regel: nur beschreiben, was sichtbar ist (Artikel + Situation),
// keine erfundenen Anlässe oder Namen. Nachtaufnahmen mit Licht zuerst.
const images = [
  {
    src: "/images/gallery/partyzelt-nacht-gedeckte-tafel-lichterketten.jpg",
    alt: "Weißes Partyzelt bei Nacht mit langer gedeckter Tafel und Lichterketten",
    caption: "3×6-m-Zelt mit Lichterketten, abends im Garten",
    link: "#zelte",
  },
  {
    src: "/images/gallery/partyzelt-lichter-fenstersektionen-nacht.jpg",
    alt: "Weißes Partyzelt mit Lichtern bei Nacht",
    caption: "Partyzelt mit Fenstersektionen und Licht bei Nacht",
    link: "#zelte",
  },
  {
    src: "/images/gallery/festtafel-weisse-stuehle-tischdecken.jpg",
    alt: "Lange Festtafel mit weißen Stühlen unter einem Zelt",
    caption: "Lange Tafel mit Stühlen und Tischdecken unterm Zelt",
    link: "#tische",
  },
  {
    src: "/images/gallery/partyzelt-tisch-acht-stuehle-terrasse.jpg",
    alt: "Partyzelt mit Tisch und Stühlen auf gepflasterter Terrasse",
    caption: "Zelt mit Tisch und acht Stühlen auf der Terrasse",
    link: "#zelte",
  },
  {
    src: "/images/gallery/festzelt-festlich-gedeckte-tafel-pflanzen.jpg",
    alt: "Festzelt mit festlich gedeckter Tafel und Pflanzen",
    caption: "Festlich gedeckte Tafel im Zelt",
    link: "#tische",
  },
  {
    src: "/images/gallery/faltpavillon-seitenwaende-tischdecke.jpg",
    alt: "Faltpavillon mit Tisch und Klappstühlen",
    caption: "3×3-m-Pavillon mit Seitenwänden, Tisch und Klappstühlen",
    link: "#zelte",
  },
];

export default function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <section className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="text-center mb-12">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Alles echt. Alles mietbar.
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Unsere Ausstattung im Einsatz
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Keine Stockfotos — diese Zelte und Garnituren standen wirklich in
            Gärten an der Bergstraße.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {images.map((img, i) => (
            <div key={i} className="flex flex-col">
              <button
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
              <div className="flex items-baseline justify-between gap-2 px-1 pt-2">
                <p className="text-gray-400 text-xs leading-snug">
                  {img.caption}
                </p>
                <a
                  href={img.link}
                  className="text-gold-400 text-xs whitespace-nowrap hover:text-gold-500 transition-colors"
                >
                  Diese Artikel mieten →
                </a>
              </div>
            </div>
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
