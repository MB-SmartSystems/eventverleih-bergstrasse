"use client";

import { useEffect } from "react";

/**
 * Cookieloses Conversion-Tracking via Umami. Feuert einmal beim Mount ein Event.
 * Auf Erfolgs-/Danke-Seiten einhängen — fasst keine Payment-/Formular-Logik an.
 */
export default function ConversionTrack({ event }: { event: string }) {
  useEffect(() => {
    (
      window as unknown as {
        umami?: { track: (e: string, d?: Record<string, unknown>) => void };
      }
    ).umami?.track(event);
  }, [event]);
  return null;
}
