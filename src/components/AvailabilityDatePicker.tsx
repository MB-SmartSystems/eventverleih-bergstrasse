"use client";

/**
 * Hero-Datepicker fuer Verfuegbarkeits-Check.
 *
 * UX (Plan Punkt 7):
 *   - Kunde gibt Mietzeitraum oben ein, klickt "Verfuegbarkeit pruefen"
 *   - Werte landen im URL-Param (?von=YYYY-MM-DD&bis=YYYY-MM-DD)
 *   - Sortiment-Liste rendert dann pro Artikel-Kachel "verfuegbar"/"nicht verfuegbar"
 *   - KEINE Anzahl-Anzeige, KEIN "wir melden uns mit Alternativen"
 *   - Default ohne Datums-Wahl: keine Badges, Sortiment normal nutzbar
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AvailabilityDatePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initial-Werte aus URL uebernehmen
  useEffect(() => {
    const vonParam = searchParams.get("von") || "";
    const bisParam = searchParams.get("bis") || "";
    if (vonParam && /^\d{4}-\d{2}-\d{2}$/.test(vonParam)) setVon(vonParam);
    if (bisParam && /^\d{4}-\d{2}-\d{2}$/.test(bisParam)) setBis(bisParam);
  }, [searchParams]);

  const minDate = todayPlus(1);
  const hasRange = !!searchParams.get("von") && !!searchParams.get("bis");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!von || !bis) {
      setError("Bitte beide Datumsfelder ausfuellen.");
      return;
    }
    if (bis < von) {
      setError("Bis-Datum muss nach Von-Datum liegen.");
      return;
    }
    if (von < minDate) {
      setError("Bitte ab morgen waehlen.");
      return;
    }
    setSubmitting(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("von", von);
    params.set("bis", bis);
    // Hash auf Sortiment, damit Kunde direkt sieht was verfuegbar ist
    router.push(`/?${params.toString()}#sortiment`);
    // Submitting-State zuruecksetzen nach kurzer Pause
    setTimeout(() => setSubmitting(false), 800);
  }

  function handleReset() {
    setVon("");
    setBis("");
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Von</label>
          <input
            type="date"
            required
            min={minDate}
            value={von}
            onChange={(e) => setVon(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Bis</label>
          <input
            type="date"
            required
            min={von || minDate}
            value={bis}
            onChange={(e) => setBis(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all text-sm"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-sm disabled:opacity-50"
          >
            {submitting ? "Pruefe..." : "Verfuegbarkeit pruefen"}
          </button>
          {hasRange && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2.5 border border-white/15 text-gray-300 rounded-lg hover:bg-white/5 transition-all text-sm"
              aria-label="Zeitraum zuruecksetzen"
            >
              ✕
            </button>
          )}
        </div>
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
