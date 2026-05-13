"use client";

import { useState } from "react";

export default function EventDatumEditor({
  buchungId,
  initialVon,
  initialBis,
}: {
  buchungId: number;
  initialVon: string | null;
  initialBis: string | null;
}) {
  const [von, setVon] = useState(initialVon ?? "");
  const [bis, setBis] = useState(initialBis ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!von) {
      setError("Bitte mindestens 'Von'-Datum angeben.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/event-datum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ von, bis: bis || von }),
      });
      const d = await res.json();
      if (!res.ok) setError([d.error, d.detail].filter(Boolean).join(" — "));
      else {
        setSaved(true);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-yellow-500/5 border border-yellow-500/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Mietzeitraum</h2>
          <p className="text-xs text-gray-400 mt-1">
            Standard-Mietdauer bis 5 Tage. Bei Event am Samstag z.B. <strong>Do–Mo</strong> oder <strong>Fr–Di</strong> reservieren —
            Artikel werden in diesem Zeitraum als belegt geführt.
          </p>
          {!initialVon && (
            <p className="text-xs text-yellow-300 mt-1">⚠ Noch nicht gesetzt — vor Freigabe ergänzen.</p>
          )}
        </div>
        {saved && <span className="text-xs text-green-400">✓ Gespeichert</span>}
      </div>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Mietbeginn (Abholung/Lieferung)</label>
          <input
            type="date"
            value={von}
            onChange={(e) => setVon(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Mietende (Rückgabe)</label>
          <input
            type="date"
            value={bis}
            onChange={(e) => setBis(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/50"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={submitting || !von}
        className="mt-3 w-full py-2 rounded bg-gold-500 hover:bg-gold-400 text-navy-900 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "Speichern …" : "Datum speichern"}
      </button>
    </section>
  );
}
