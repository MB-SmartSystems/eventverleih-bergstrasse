"use client";

import { useEffect, useState } from "react";
import { useCart } from "./CartContext";
import DateRangeSheet from "./DateRangeSheet";
import { formatGermanShort } from "@/lib/eventverleih/constants";

export default function StickyDateBar() {
  const { rangeVon, rangeBis } = useCart();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  if (!visible) return null;

  const hasRange = Boolean(rangeVon && rangeBis);
  const label = hasRange
    ? `${formatGermanShort(rangeVon!)} — ${formatGermanShort(rangeBis!)}`
    : "Mietzeitraum wählen";

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
            {hasRange ? "ändern" : "wählen"}
          </button>
        </div>
      </div>

      <DateRangeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
