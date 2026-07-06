"use client";

import { useEffect, useMemo, useState } from "react";
import {
  empfehlung,
  maxGaeste,
  zusatzEmpfehlungen,
  SLUGS,
  MIN_GAESTE,
} from "@/lib/eventverleih/set-empfehlung";
import { useCart } from "@/components/CartContext";
import SetLayoutSvg from "@/components/SetLayoutSvg";

interface Product {
  id: string;
  category: string;
  slug: string;
  name: string;
  price: string;
  mietpreisEur: number | null;
  kautionEur: number | null;
  bestandOk: number;
}

export default function GaestezahlSet() {
  const { items, addItem, updateQuantity, clearCart } = useCart();

  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [g, setG] = useState(10);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data?.products)) {
          setProducts(data.products as Product[]);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Produkt-Lookup per slug
  const bySlug = useMemo(() => {
    const map = new Map<string, Product>();
    (products || []).forEach((p) => map.set(p.slug, p));
    return map;
  }, [products]);

  const bestand = useMemo(() => {
    const stuhl = bySlug.get(SLUGS.stuhl)?.bestandOk ?? 0;
    const tisch = bySlug.get(SLUGS.tisch)?.bestandOk ?? 0;
    return { stuhl, tisch };
  }, [bySlug]);

  const maxG = maxGaeste(bestand);
  const e = useMemo(() => empfehlung(g, bestand), [g, bestand]);

  // Nur Positionen mit vorhandenem Produkt (unabhängig von Bestand → für Anzeige);
  // Verfügbarkeit wird pro Zeile separat markiert.
  const aufgeloest = useMemo(() => {
    return e.positionen.map((pos) => {
      const prod = bySlug.get(pos.slug);
      return {
        slug: pos.slug,
        anzahl: pos.anzahl,
        product: prod ?? null,
        verfuegbar: !!prod && prod.bestandOk > 0,
      };
    });
  }, [e.positionen, bySlug]);

  // Setzt eine exakte Menge N für ein evtl. noch nicht enthaltenes Produkt.
  function setMenge(name: string, price: string, n: number) {
    addItem(name, price); // erzeugt qty 1 (oder +1 falls schon drin)
    updateQuantity(name, n); // überschreibt auf N
  }

  function inDenWarenkorb() {
    const gueltigePos = aufgeloest.filter((p) => p.verfuegbar && p.product);
    if (gueltigePos.length === 0) return;

    if (items.length > 0) {
      const ersetzen = window.confirm(
        "Du hast bereits Artikel im Warenkorb.\n\nOK = Warenkorb durch dieses Set ersetzen\nAbbrechen = Set zusätzlich hinzufügen",
      );
      if (ersetzen) clearCart();
    }

    gueltigePos.forEach((p) => {
      if (p.product) setMenge(p.product.name, p.product.price, p.anzahl);
    });

    setFeedback("Set im Warenkorb – Mengen kannst du dort noch anpassen.");
  }

  // Zusatz-Empfehlungen (dezent, nicht automatisch)
  const monat = new Date().getMonth() + 1;
  const zusatzSlugs = useMemo(() => zusatzEmpfehlungen(monat), [monat]);
  const zusatzListe = useMemo(() => {
    return zusatzSlugs
      .map((slug) => {
        const prod = bySlug.get(slug);
        // Zusatz-Empfehlungen (Stehtisch/Heizpilz) auch zeigen, wenn bestellbar (Bestand_OK=0):
        // es sind kuratierte "passt dazu?"-Vorschläge, keine Auto-Set-Positionen.
        if (!prod) return null;
        return { slug, product: prod };
      })
      .filter((x): x is { slug: string; product: Product } => x !== null);
  }, [zusatzSlugs, bySlug]);

  function zusatzHinzufuegen(slug: string, prod: Product) {
    addItem(prod.name, prod.price); // +1
    if (slug === SLUGS.heizpilz) {
      const gas = bySlug.get(SLUGS.gasflasche);
      if (gas && gas.bestandOk > 0) {
        addItem(gas.name, gas.price); // +1 Gasflasche dazu
      }
    }
    setFeedback(`„${prod.name}" hinzugefügt.`);
  }

  const loading = products === null && !loadError;

  return (
    <section id="sets" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="text-center mb-12">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Set-Planer
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Wie viele Gäste? – wir stellen dein Set zusammen
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Sag uns einfach, wie viele kommen – wir schlagen dir Zelt, Tische,
            Stühle und Licht in der passenden Menge vor. Anpassen kannst du
            danach jederzeit Artikel für Artikel.
          </p>
        </div>

        {loadError && (
          <div className="glass-card p-6 md:p-8 max-w-2xl mx-auto text-center">
            <p className="text-gray-300">
              Der Set-Planer ist gerade nicht erreichbar. Stell dir dein Set{" "}
              <a
                href="#sortiment"
                className="text-gold-400 underline underline-offset-2 hover:text-gold-500 transition-colors"
              >
                unten im Sortiment
              </a>{" "}
              selbst zusammen oder{" "}
              <a
                href="#kontakt"
                className="text-gold-400 underline underline-offset-2 hover:text-gold-500 transition-colors"
              >
                schreib uns
              </a>
              .
            </p>
          </div>
        )}

        {loading && (
          <div className="glass-card p-6 md:p-8 max-w-2xl mx-auto text-center">
            <p className="text-gray-400 animate-pulse">Set-Planer wird geladen …</p>
          </div>
        )}

        {!loading && !loadError && (
          <div className="max-w-3xl mx-auto">
            {/* Eingabe */}
            <div className="glass-card p-6 md:p-8 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <label htmlFor="gaeste-zahl" className="text-white font-medium whitespace-nowrap">
                  Anzahl Gäste
                </label>
                <input
                  id="gaeste-zahl"
                  type="number"
                  min={MIN_GAESTE}
                  value={g}
                  onChange={(ev) => {
                    const v = parseInt(ev.target.value, 10);
                    setG(Number.isNaN(v) ? 0 : v);
                    setFeedback(null);
                  }}
                  className="w-24 px-3 py-2 rounded-lg bg-navy-900 border border-gold-500/30 text-white text-lg text-center focus:outline-none focus:border-gold-400"
                />
                <input
                  type="range"
                  min={1}
                  max={Math.max(maxG, 1)}
                  value={Math.min(Math.max(g, 1), Math.max(maxG, 1))}
                  onChange={(ev) => {
                    setG(parseInt(ev.target.value, 10));
                    setFeedback(null);
                  }}
                  className="flex-1 accent-gold-400"
                  aria-label="Gästezahl per Schieberegler"
                />
              </div>
            </div>

            {/* Ungültig → Fallback */}
            {!e.gueltig && (
              <div className="glass-card p-6 md:p-8 text-center">
                <p className="text-gray-300 leading-relaxed">
                  Für größere Feiern (mehr als {e.maxGaeste} Gäste) stell dir dein
                  Set{" "}
                  <a
                    href="#sortiment"
                    className="text-gold-400 underline underline-offset-2 hover:text-gold-500 transition-colors"
                  >
                    unten im Sortiment
                  </a>{" "}
                  selbst zusammen — oder melde dich für ein{" "}
                  <a
                    href="#kontakt"
                    className="text-gold-400 underline underline-offset-2 hover:text-gold-500 transition-colors"
                  >
                    persönliches Angebot
                  </a>
                  .
                </p>
              </div>
            )}

            {/* Gültig → Set */}
            {e.gueltig && (
              <div className="glass-card p-6 md:p-8">
                <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
                  <div className="bg-navy-900/50 rounded-xl p-4">
                    <SetLayoutSvg zelt={e.zelt} tische={e.tische} stuehle={e.stuehle} />
                    <p className="text-center text-xs text-gray-500 mt-2">
                      Schematische Draufsicht – grobe Orientierung
                    </p>
                  </div>

                  <div>
                    <h3 className="font-display text-xl font-semibold text-white mb-4">
                      Dein Set für {e.stuehle} Gäste
                    </h3>
                    <ul className="space-y-2 mb-4">
                      {aufgeloest.map((pos) => {
                        if (!pos.product) return null;
                        return (
                          <li
                            key={pos.slug}
                            className="flex items-baseline justify-between gap-3 text-sm"
                          >
                            <span className="text-gray-300">{pos.product.name}</span>
                            {pos.verfuegbar ? (
                              <span className="text-gold-400 font-medium whitespace-nowrap">
                                × {pos.anzahl}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-xs whitespace-nowrap">
                                aktuell nicht verfügbar
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <p className="text-xs text-gray-500 mb-5">
                      ab 9 Gästen kommt ein 2. Tisch dazu · ab 13 das größere
                      3×6-Zelt
                    </p>

                    <button
                      type="button"
                      onClick={inDenWarenkorb}
                      className="block w-full py-3 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold rounded-lg transition-all text-sm"
                    >
                      Set in den Warenkorb
                    </button>

                    {feedback && (
                      <p className="text-sm text-gold-400 mt-3 text-center">
                        {feedback}{" "}
                        <a
                          href="/cart"
                          className="underline underline-offset-2 hover:text-gold-500"
                        >
                          Zum Warenkorb
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Zusatz-Empfehlungen */}
                {zusatzListe.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-sm text-gray-400 mb-3">Passt vielleicht dazu?</p>
                    <div className="flex flex-col gap-2">
                      {zusatzListe.map(({ slug, product }) => (
                        <div
                          key={slug}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-gray-300">
                            {product.name}
                            {slug === SLUGS.heizpilz && (
                              <span className="text-gray-500"> (inkl. Gasflasche)</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => zusatzHinzufuegen(slug, product)}
                            className="px-3 py-1.5 border border-gold-500/30 text-gold-400 rounded-lg hover:bg-gold-500/10 transition-all whitespace-nowrap"
                          >
                            + hinzufügen
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Kontakt-Zeile */}
            <p className="text-center text-gray-400 text-sm max-w-2xl mx-auto mt-8">
              Taufe, Einschulung, Abschlussfeier, Jubiläum?{" "}
              <a
                href="#kontakt"
                className="text-gold-400 hover:text-gold-500 transition-colors underline underline-offset-2"
              >
                Anlass, Datum und Gästezahl schicken
              </a>
              , wir schlagen ein Setup aus unseren Artikeln vor. Lieber selbst
              stöbern?{" "}
              <a
                href="#sortiment"
                className="text-gold-400 hover:text-gold-500 transition-colors underline underline-offset-2"
              >
                Zum Sortiment
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
