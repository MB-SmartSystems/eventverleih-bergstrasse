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
              senden Sie uns die Anfrage über den Warenkorb — wir melden uns mit
              Verfügbarkeit und einem klaren Angebot.
            </p>

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
                Alles läuft bequem online über die Anfrage — Auswahl, Zeitraum und Angebot klar dokumentiert. Wir melden uns mit
                Verfügbarkeit und einem klaren Angebot.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
