"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { formatGerman, rangeDays } from "@/lib/eventverleih/constants";

// Parst "45,00 €" / "45,00" / "45.00" → 45.00. Auf-Anfrage (0 oder leer) → null.
function parsePrice(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, "").replace(/€/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

function formatEur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function CartDrawer() {
  const {
    items,
    totalItems,
    addItem,
    removeItem,
    updateQuantity,
    drawerOpen,
    closeDrawer,
    rangeVon,
    rangeBis,
  } = useCart();

  // Body-Scroll-Lock + Escape-Key zum Schliessen
  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  const hasRange = Boolean(rangeVon && rangeBis);
  const dauerTage = hasRange ? rangeDays(rangeVon!, rangeBis!) + 1 : 0;

  // Quick-Mietsumme (nur Mietpreis, ohne Kaution/Aufbau — Voll-Breakdown auf /cart-Page)
  const miete = items.reduce((sum, i) => {
    const p = parsePrice(i.price);
    return sum + (p ?? 0) * i.quantity;
  }, 0);
  const aufAnfrageCount = items.filter((i) => parsePrice(i.price) === null).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end items-end md:items-stretch"
      role="dialog"
      aria-modal="true"
      aria-label="Warenkorb"
    >
      <button
        type="button"
        aria-label="Schließen"
        onClick={closeDrawer}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />

      {/* Container: Bottom-Sheet Mobile, Right-Drawer Desktop */}
      <div
        className="
          relative w-full md:w-[480px] md:max-w-[90vw]
          bg-navy-900 border-t md:border-l border-white/10
          md:rounded-none rounded-t-2xl
          shadow-2xl
          max-h-[90vh] md:max-h-none md:h-full
          flex flex-col
          animate-slide-up md:animate-slide-in-right
        "
      >
        {/* Header */}
        <div className="sticky top-0 bg-navy-900/95 backdrop-blur-md border-b border-white/10 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
            Warenkorb
            {totalItems > 0 && (
              <span className="text-sm text-gray-400 font-normal">
                ({totalItems} {totalItems === 1 ? "Artikel" : "Artikel"})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="w-8 h-8 rounded-md text-gray-400 hover:bg-white/10 hover:text-white inline-flex items-center justify-center transition-colors"
            aria-label="Schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                />
              </svg>
              <p className="text-white font-medium mb-2">Ihr Warenkorb ist leer.</p>
              <p className="text-gray-400 text-sm mb-6">Wählen Sie Artikel aus dem Sortiment aus.</p>
              <button
                onClick={closeDrawer}
                className="inline-block px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold text-sm rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
              >
                Sortiment ansehen
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const p = parsePrice(item.price);
                const subtotal = p !== null ? p * item.quantity : null;
                return (
                  <li
                    key={item.name}
                    className="glass-card p-3 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm leading-snug truncate">
                        {item.name}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {p !== null ? `${item.price} pro Wochenende` : "Preis auf Anfrage"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => removeItem(item.name)}
                          className="w-7 h-7 rounded-md border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all"
                          aria-label={`Anzahl von ${item.name} verringern`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="text-white font-semibold text-sm w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addItem(item.name, item.price)}
                          className="w-7 h-7 rounded-md bg-gold-500 text-navy-900 flex items-center justify-center hover:bg-gold-400 transition-all"
                          aria-label={`Anzahl von ${item.name} erhöhen`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => updateQuantity(item.name, 0)}
                          className="ml-1 w-7 h-7 rounded-md text-gray-400 hover:text-red-300 hover:bg-red-500/10 inline-flex items-center justify-center transition-all"
                          aria-label={`${item.name} komplett entfernen`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-gold-400 font-semibold text-sm whitespace-nowrap">
                        {subtotal !== null ? formatEur(subtotal) : "Auf Anfrage"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer mit Quick-Preis + CTA */}
        {items.length > 0 && (
          <div className="border-t border-white/10 bg-navy-900/95 backdrop-blur-md px-5 py-4 flex-shrink-0">
            {hasRange ? (
              <div className="mb-3 text-sm text-gray-400">
                Mietzeitraum: <span className="text-white">{formatGerman(rangeVon!)} – {formatGerman(rangeBis!)}</span>
                <span className="text-gray-500"> ({dauerTage} {dauerTage === 1 ? "Tag" : "Tage"})</span>
              </div>
            ) : (
              <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                Bitte wählen Sie noch einen Mietzeitraum, um einen Gesamtpreis zu sehen.
              </div>
            )}

            <div className="flex items-baseline justify-between mb-3">
              <span className="text-gray-400 text-sm">Mietpreis (ohne Kaution / Aufbau)</span>
              <span className="text-white font-bold text-lg">{formatEur(miete)}</span>
            </div>
            {aufAnfrageCount > 0 && (
              <p className="text-xs text-gray-500 mb-3">
                + {aufAnfrageCount} Artikel auf Anfrage (Preis im Angebot)
              </p>
            )}

            <Link
              href="/cart"
              onClick={closeDrawer}
              className="block w-full text-center px-5 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold text-sm rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
            >
              Zur Buchung →
            </Link>
            <p className="text-xs text-gray-500 text-center mt-2">
              Unverbindliche Anfrage. Keine Zahlung jetzt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
