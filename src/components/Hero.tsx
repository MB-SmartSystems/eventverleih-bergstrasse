import Image from "next/image";

const categories = [
  {
    label: "Zelte & Zubehör",
    href: "#zelte",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
      </svg>
    ),
  },
  {
    label: "Tische & Stühle",
    href: "#tische",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M3.75 6v12m0-12l1.5 12M20.25 6v12m0-12l-1.5 12M5.25 18h13.5" />
      </svg>
    ),
  },
  {
    label: "Beleuchtung & Heizung",
    href: "#beleuchtung",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
  },
  {
    label: "Deko & Spiele",
    href: "#deko",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
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
              className="glass-card p-4 md:p-5 text-center hover:bg-white/10 transition-all group cursor-pointer flex flex-col items-center"
            >
              <span className="text-gold-400 block mb-2">
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
