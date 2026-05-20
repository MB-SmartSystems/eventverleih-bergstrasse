"use client";

import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import DateRangePicker from "./DateRangePicker";
import { formatGermanShort } from "@/lib/eventverleih/constants";

export default function StickyDateBar() {
  const { rangeVon, rangeBis, setRange, hydrated } = useCart();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // IntersectionObserver auf #start (Hero) — wenn Hero out of view, Sticky-Bar zeigen
  useEffect(() => {
    const el = document.getElementById("start");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "-60px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Body-Scroll-Lock + ESC-Close fuer Bottom-Sheet
  useEffect(() => {
    if (!sheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  if (!visible) return null;

  const hasRange = Boolean(rangeVon && rangeBis);
  const label = hasRange
    ? `${formatGermanShort(rangeVon!)} — ${formatGermanShort(rangeBis!)}`
    : "Mietzeitraum waehlen";

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-navy-900/95 backdrop-blur-md border-b border-white/10 animate-slide-down"
        role="region"
        aria-label="Aktueller Mietzeitraum"
      >
        <div className="container-width px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <svg
              className="w-4 h-4 text-gold-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25"
              />
            </svg>
            <span
              className={`truncate ${hasRange ? "text-white font-medium" : "text-gray-400"}`}
            >
              {label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="px-3 py-1.5 rounded-md border border-gold-500/40 text-gold-400 text-sm hover:bg-gold-500/10 transition-colors whitespace-nowrap"
          >
            {hasRange ? "aendern" : "waehlen"}
          </button>
        </div>
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Mietzeitraum waehlen"
        >
          <button
            type="button"
            aria-label="Schliessen"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
          />
          <div className="relative w-full md:max-w-3xl bg-navy-900 border-t md:border border-white/10 md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up md:animate-fade-in">
            <div className="sticky top-0 bg-navy-900/95 backdrop-blur-md border-b border-white/10 px-5 py-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">
                Mietzeitraum waehlen
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-8 h-8 rounded-md text-gray-400 hover:bg-white/10 hover:text-white inline-flex items-center justify-center transition-colors"
                aria-label="Schliessen"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-5 flex justify-center">
              {hydrated ? (
                <DateRangePicker
                  rangeVon={rangeVon}
                  rangeBis={rangeBis}
                  onChange={(von, bis) => {
                    setRange(von, bis);
                    if (von && bis) {
                      // Auto-close kurz nach komplettem Range
                      window.setTimeout(() => setSheetOpen(false), 250);
                    }
                  }}
                  variant="public"
                />
              ) : (
                <div className="h-72 w-full max-w-md animate-pulse bg-white/5 rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
