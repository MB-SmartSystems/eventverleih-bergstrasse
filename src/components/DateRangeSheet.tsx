"use client";

import { useEffect } from "react";
import { useCart } from "./CartContext";
import DateRangePicker from "./DateRangePicker";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DateRangeSheet({ open, onClose }: Props) {
  const { rangeVon, rangeBis, setRange, hydrated } = useCart();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Mietzeitraum waehlen"
    >
      <button
        type="button"
        aria-label="Schliessen"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />
      <div className="relative w-full md:max-w-3xl bg-navy-900 border-t md:border border-white/10 md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up md:animate-fade-in">
        <div className="sticky top-0 bg-navy-900/95 backdrop-blur-md border-b border-white/10 px-5 py-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">
            Mietzeitraum waehlen
          </h2>
          <button
            type="button"
            onClick={onClose}
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
                  window.setTimeout(onClose, 250);
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
  );
}
