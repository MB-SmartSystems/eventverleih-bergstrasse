"use client";

import { useCart } from "./CartContext";
import DateRangePicker from "./DateRangePicker";
import AvailabilityCounter from "./AvailabilityCounter";
import { formatGerman } from "@/lib/eventverleih/constants";

export default function HeroBookingPanel() {
  const { rangeVon, rangeBis, setRange, hydrated } = useCart();

  const handleScrollToSortiment = () => {
    const el = document.getElementById("sortiment");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const hasFullRange = Boolean(rangeVon && rangeBis);

  return (
    <div
      id="datepicker"
      className="glass-card p-5 md:p-7 mb-10 max-w-3xl"
      aria-labelledby="datepicker-heading"
    >
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2 mb-4">
        <h2
          id="datepicker-heading"
          className="font-display text-2xl md:text-3xl font-semibold text-white"
        >
          Wann brauchst du es?
        </h2>
        <p className="text-gray-400 text-sm">
          Liefer- und Rueckgabetag waehlen — max. 5 Tage.
        </p>
      </div>

      {hasFullRange && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gold-400">
          <svg
            className="w-4 h-4"
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
          <span>
            {formatGerman(rangeVon!)} &mdash; {formatGerman(rangeBis!)}
          </span>
        </div>
      )}

      <div className="flex justify-center md:justify-start mb-4 overflow-x-auto">
        {hydrated ? (
          <DateRangePicker
            rangeVon={rangeVon}
            rangeBis={rangeBis}
            onChange={setRange}
            variant="public"
          />
        ) : (
          <div className="h-72 w-full max-w-md animate-pulse bg-white/5 rounded-lg" />
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <AvailabilityCounter rangeVon={rangeVon} rangeBis={rangeBis} />
        </div>
        {hasFullRange && (
          <button
            type="button"
            onClick={handleScrollToSortiment}
            className="px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-sm whitespace-nowrap"
          >
            Sortiment ansehen →
          </button>
        )}
      </div>
    </div>
  );
}
