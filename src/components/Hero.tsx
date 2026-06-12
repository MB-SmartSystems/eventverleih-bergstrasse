"use client";

import Image from "next/image";
import HeroBookingPanel from "./HeroBookingPanel";

// Anlass-Einstieg statt Kategorie-Einstieg: Besucher erkennen ihr Fest,
// nicht unsere Warengruppen. Drei Anlässe → Anlass-Sets, der Rest → Kontakt.
const anlaesse = [
  {
    label: "Geburtstag",
    sub: "rund oder einfach so",
    href: "#sets",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265z" />
      </svg>
    ),
  },
  {
    label: "Gartenfest",
    sub: "mit Nachbarn & Freunden",
    href: "#sets",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    label: "Kleine Hochzeit",
    sub: "Feier im eigenen Garten",
    href: "#sets",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    label: "Anderes Fest?",
    sub: "Sagen Sie uns, was Sie vorhaben",
    href: "#kontakt",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
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
            Eventverleih Bergstraße · Alsbach-Hähnlein & Umgebung
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Was feiern <span className="gold-text">Sie?</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
            Geburtstag, Gartenfest oder kleine Hochzeit im eigenen Garten:
            Zelt, Tische, Stühle und Licht mieten Sie hier direkt online —
            Datum wählen, 30&nbsp;% anzahlen, an der Bergstraße abholen oder
            liefern lassen.
          </p>
        </div>

        <HeroBookingPanel />

        {/* Anlass-Karten */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {anlaesse.map((anlass) => (
            <a
              key={anlass.label}
              href={anlass.href}
              className="glass-card p-4 md:p-5 text-center hover:bg-white/10 transition-all group cursor-pointer flex flex-col items-center"
            >
              <span className="text-gold-400 block mb-2">
                {anlass.icon}
              </span>
              <span className="text-sm md:text-base font-medium text-gray-200 group-hover:text-gold-400 transition-colors">
                {anlass.label}
              </span>
              <span className="text-xs text-gray-400 mt-0.5">
                {anlass.sub}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
