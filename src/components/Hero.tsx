import Image from "next/image";

const categories = [
  { label: "Zelte & Zubehör", icon: "⛺", href: "#zelte" },
  { label: "Tische & Stühle", icon: "🪑", href: "#tische" },
  { label: "Beleuchtung & Heizung", icon: "💡", href: "#beleuchtung" },
  { label: "Deko & Spiele", icon: "🎯", href: "#deko" },
];

export default function Hero() {
  return (
    <section
      id="start"
      className="relative min-h-screen flex items-center pt-20"
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/gallery/partyzelt-beleuchtet-terrasse-nacht.jpg"
          alt="Beleuchtetes Partyzelt bei Nacht"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/80 via-navy-900/60 to-navy-900" />
      </div>

      <div className="relative z-10 container-width px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="max-w-3xl">
          <p className="text-gold-400 text-sm md:text-base font-medium tracking-widest uppercase mb-4">
            Regionaler Eventverleih an der Bergstraße
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Zelte & Ausstattung{" "}
            <span className="gold-text">für Ihre Feste</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Funktionale Zelte, Tische, Stühle und Eventausstattung —
            zuverlässig, transparent und regional an der Bergstraße und
            Umgebung.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <a
              href="#kontakt"
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg"
            >
              Jetzt Anfrage starten
            </a>
            <a
              href="#sortiment"
              className="inline-flex items-center justify-center px-8 py-4 border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-all text-lg"
            >
              Sortiment ansehen
            </a>
          </div>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {categories.map((cat) => (
            <a
              key={cat.label}
              href={cat.href}
              className="glass-card p-4 md:p-5 text-center hover:bg-white/10 transition-all group cursor-pointer"
            >
              <span className="text-2xl md:text-3xl block mb-2">
                {cat.icon}
              </span>
              <span className="text-sm md:text-base font-medium text-gray-200 group-hover:text-gold-400 transition-colors">
                {cat.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
