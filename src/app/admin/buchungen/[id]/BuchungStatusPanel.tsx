"use client";

import { useState } from "react";

const STATI = [
  "Anfrage",
  "Angebot_erstellt",
  "Angebot_versendet",
  "Reserviert",
  "Bestaetigt",
  "Uebergeben",
  "In_Miete",
  "Zurueckgegeben",
  "Abgerechnet",
  "Storniert",
  "No_Show",
];

export default function BuchungStatusPanel({
  buchungId,
  currentStatus,
}: {
  buchungId: number;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (status === currentStatus) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <h2 className="text-lg font-semibold text-warm-text mb-3">Status ändern</h2>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        disabled={submitting}
        className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {STATI.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={submitting || status === currentStatus}
        className="w-full mt-3 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Speichern …" : "Status speichern"}
      </button>
    </section>
  );
}
