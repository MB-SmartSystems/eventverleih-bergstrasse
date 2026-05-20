"use client";

/**
 * Hero-Datepicker fuer Verfuegbarkeits-Check.
 *
 * UX (Plan ich-hab-mal-bitte-snappy-boole, Punkt 7):
 *   - Kunde gibt Mietzeitraum oben ein, klickt "Verfuegbarkeit pruefen"
 *   - Werte landen im URL-Param (?von=YYYY-MM-DD&bis=YYYY-MM-DD)
 *   - Sortiment-Liste rendert dann pro Artikel-Kachel "verfuegbar"/"nicht verfuegbar"
 *   - KEINE Anzahl-Anzeige, KEIN "wir melden uns mit Alternativen"
 *   - Default ohne Datums-Wahl: keine Badges, Sortiment normal nutzbar
 *
 * Datepicker = unsere eigene DateRangePicker-Komponente (gross genuger Popup-Kalender
 * mit Monats-Pfeilen, Quick-Picks fuer typische Mietdauern, Smart-Default Von+3).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import DateRangePicker, { type DateRange } from "./DateRangePicker";

export default function AvailabilityDatePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [range, setRange] = useState<DateRange>({ von: "", bis: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initial-Werte aus URL uebernehmen
  useEffect(() => {
    const vonParam = searchParams.get("von") || "";
    const bisParam = searchParams.get("bis") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(vonParam) || /^\d{4}-\d{2}-\d{2}$/.test(bisParam)) {
      setRange({ von: vonParam, bis: bisParam });
    }
  }, [searchParams]);

  const hasRange = !!searchParams.get("von") && !!searchParams.get("bis");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!range.von || !range.bis) {
      setError("Bitte beide Datumsfelder auswaehlen.");
      return;
    }
    setSubmitting(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("von", range.von);
    params.set("bis", range.bis);
    router.push(`/?${params.toString()}#sortiment`);
    setTimeout(() => setSubmitting(false), 800);
  }

  function handleReset() {
    setRange({ von: "", bis: "" });
    setError("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("von");
    params.delete("bis");
    router.push(params.toString() ? `/?${params.toString()}` : "/");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-5 md:p-6 mb-10 max-w-2xl"
      aria-label="Verfuegbarkeit pruefen"
    >
      <div className="text-sm text-gray-300 mb-4 font-medium">
        Pruefen Sie direkt die Verfuegbarkeit zu Ihrem Wunsch-Zeitraum
      </div>
      <DateRangePicker value={range} onChange={setRange} layout="hero" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-sm disabled:opacity-50 cursor-pointer"
        >
          {submitting ? "Pruefe..." : "Verfuegbarkeit pruefen"}
        </button>
        {hasRange && (
          <button
            type="button"
            onClick={handleReset}
            className="py-2.5 border border-white/15 text-gray-300 rounded-lg hover:bg-white/5 transition-all text-sm cursor-pointer"
          >
            Zeitraum zuruecksetzen
          </button>
        )}
      </div>
      {error && (
        <div className="mt-3 text-sm text-red-300">{error}</div>
      )}
      {hasRange && !error && (
        <div className="mt-3 text-xs text-gold-300">
          Im Sortiment werden jetzt die Verfuegbarkeit-Badges angezeigt.
        </div>
      )}
    </form>
  );
}
