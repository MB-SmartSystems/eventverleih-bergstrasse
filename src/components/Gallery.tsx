import Image from "next/image";

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
            <div
              key={i}
              className="relative aspect-[4/3] rounded-xl overflow-hidden group"
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-navy-900/20 group-hover:bg-navy-900/0 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
