"use client";

import { useState } from "react";
import { useCart } from "./CartContext";
import DateRangeSheet from "./DateRangeSheet";
import { formatGermanShort } from "@/lib/eventverleih/constants";

export default function HeroBookingPanel() {
  const { rangeVon, rangeBis, clearRange } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasFullRange = Boolean(rangeVon && rangeBis);

  const handleScrollToSortiment = () => {
    const el = document.getElementById("sortiment");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleOpenSheet = () => {
    // Wenn schon eine Range gesetzt war, vorher clearen. Sonst hat
    // react-day-picker-Range-Mode mit existing Range das Verhalten,
    // dass ein Klick nur den naehesten Endpunkt verschiebt — und der
    // User kann den Start nicht mehr aendern.
    if (hasFullRange) clearRange();
    setSheetOpen(true);
  };

  const buttonLabel = hasFullRange
    ? `${formatGermanShort(rangeVon!)} — ${formatGermanShort(rangeBis!)}`
    : "Mietzeitraum auswählen";

  return (
    <>
      <div
        id="datepicker"
        className="glass-card p-5 md:p-6 mb-10 max-w-2xl"
        aria-labelledby="datepicker-heading"
      >
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 mb-4">
          <h2
            id="datepicker-heading"
            className="font-display text-xl md:text-2xl font-semibold text-white"
          >
            Wann findet Ihre Feier statt?
          </h2>
          <p className="text-gray-400 text-xs">max. 5 Tage Mietdauer</p>
        </div>

        <button
          type="button"
          onClick={handleOpenSheet}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-gold-500/40 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          aria-haspopup="dialog"
        >
          <span className="flex items-center gap-3 min-w-0">
            <svg
              className="w-5 h-5 text-gold-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
            <span
              className={`truncate text-left ${
                hasFullRange
                  ? "text-white font-medium"
                  : "text-gray-400"
              }`}
            >
              {buttonLabel}
            </span>
          </span>
          <svg
            className="w-4 h-4 text-gray-400 group-hover:text-gold-400 transition-colors flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {hasFullRange && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleScrollToSortiment}
              className="px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-sm whitespace-nowrap"
            >
              Verfügbarkeit für mein Datum prüfen →
            </button>
          </div>
        )}

        <p className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-400">
          Sicher online zahlen (Stripe) · Abholung in Alsbach-Hähnlein oder
          Lieferung auf Wunsch
        </p>
      </div>

      <DateRangeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
