"use client";

import { useState, useEffect } from "react";
import type { Promotion } from "@/lib/types";

const BANNER_ID = "promo-banner-active";

export default function PromoBanner() {
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("promo-dismissed")) {
      setDismissed(true);
      return;
    }
    fetch("/api/promotions/active")
      .then((r) => r.json())
      .then((d) => {
        if (d.promotion) setPromo(d.promotion);
      })
      .catch(() => {});
  }, []);

  if (!promo || dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem("promo-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div
      id={BANNER_ID}
      className="fixed top-0 left-0 right-0 z-[60] py-2.5 px-4 text-center text-white text-sm font-medium"
      style={{ backgroundColor: promo.bannerColor || "#1e293b" }}
    >
      <a href="#sortiment" className="hover:underline">
        <span className="font-semibold text-gold-400">{promo.title}</span>
        {promo.description && (
          <span className="hidden sm:inline text-white/90"> — {promo.description}</span>
        )}
        <span className="ml-2 underline underline-offset-2 text-gold-400">
          Jetzt entdecken
        </span>
      </a>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
        aria-label="Banner schliessen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
