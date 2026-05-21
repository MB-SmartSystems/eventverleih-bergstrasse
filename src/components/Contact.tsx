"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartContext";

export default function Contact() {
  const { totalItems, hydrated } = useCart();
  const hasItems = hydrated && totalItems > 0;

  return (
    <section id="kontakt" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Linke Spalte: Info + Direkt-Kontakt */}
          <div>
            <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
              Kontakt
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
              Lassen Sie uns Ihr Fest planen
            </h2>
            <p className="text-gray-400 leading-relaxed mb-10">
              Sie möchten Zelte oder Eventausstattung für Ihre Feier mieten? Wählen Sie oben Ihre Wunsch-Artikel aus und
              senden Sie uns die Anfrage über den Warenkorb. Oder schreiben Sie direkt — wir melden uns mit
              Verfügbarkeit und einem klaren Angebot.
            </p>

            <div className="space-y-4 mb-10">
              <a
                href="https://wa.me/4915679521124"
                className="flex items-center gap-4 glass-card p-4 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-gold-400 transition-colors">WhatsApp</div>
                  <div className="text-gray-400 text-sm">+49 156 79521124</div>
                </div>
              </a>

              <a
                href="tel:+4915679521124"
                className="flex items-center gap-4 glass-card p-4 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-gold-400 transition-colors">Telefon</div>
                  <div className="text-gray-400 text-sm">+49 156 79521124</div>
                </div>
              </a>

              <a
                href="mailto:info@eventverleih-bergstrasse.de"
                className="flex items-center gap-4 glass-card p-4 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-gold-400 transition-colors">E-Mail</div>
                  <div className="text-gray-400 text-sm">info@eventverleih-bergstrasse.de</div>
                </div>
              </a>
            </div>

            <div className="relative aspect-[16/9] rounded-xl overflow-hidden hidden lg:block">
              <Image
                src="/images/gallery/partyzelt-lange-tafel-stuehle-nacht.jpg"
                alt="Beleuchtetes Partyzelt bei Nacht"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Rechte Spalte: Hinweis zum Warenkorb-Flow */}
          <div className="lg:sticky lg:top-28 self-start">
            <div className="glass-card p-6 md:p-8">
              <h3 className="font-display text-xl font-semibold mb-2">
                {hasItems ? "Ihre Auswahl ist bereit." : "So funktioniert die Anfrage."}
              </h3>

              {hasItems ? (
                <>
                  <p className="text-gray-400 text-sm mb-6">
                    Sie haben {totalItems} {totalItems === 1 ? "Artikel" : "Artikel"} im Warenkorb. Im nächsten Schritt
                    ergänzen Sie Ihre Kontaktdaten und senden uns die unverbindliche Anfrage.
                  </p>
                  <Link
                    href="/cart"
                    className="block text-center w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg"
                  >
                    Zur Buchung →
                  </Link>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Unverbindlich. Keine Zahlung jetzt.
                  </p>
                </>
              ) : (
                <>
                  <ol className="space-y-3 mb-6 text-sm text-gray-300">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold flex items-center justify-center">
                        1
                      </span>
                      <span>
                        Mietzeitraum oben wählen (für die Verfügbarkeits-Anzeige).
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold flex items-center justify-center">
                        2
                      </span>
                      <span>
                        Artikel im Sortiment in den Warenkorb legen.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold flex items-center justify-center">
                        3
                      </span>
                      <span>
                        Zum Warenkorb wechseln, Kontaktdaten eintragen, Anfrage senden.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold flex items-center justify-center">
                        4
                      </span>
                      <span>
                        Wir melden uns innerhalb 24 Stunden mit einem konkreten Angebot.
                      </span>
                    </li>
                  </ol>
                  <a
                    href="#sortiment"
                    className="block text-center w-full py-3 border border-gold-500/30 text-gold-400 font-medium rounded-lg hover:bg-gold-500/10 transition-all"
                  >
                    Zum Sortiment
                  </a>
                </>
              )}

              <div className="mt-6 pt-6 border-t border-white/10 text-xs text-gray-500 leading-relaxed">
                Oder schreiben Sie uns direkt per WhatsApp, Telefon oder E-Mail (siehe links). Wir melden uns mit
                Verfügbarkeit und einem klaren Angebot.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
