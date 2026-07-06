"use client";

import { useState } from "react";

const MAHNSTUFEN = ["keine", "M1", "M2", "M3", "Inkasso"];
const ZAHLUNGSMETHODEN = ["Bar", "Ueberweisung", "PayPal", "Stripe"];

export default function RechnungActionPanel({
  rechnungId,
  isPaid,
  mahnstufe,
}: {
  rechnungId: number;
  isPaid: boolean;
  mahnstufe: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [zahlungsMethode, setZahlungsMethode] = useState("Ueberweisung");
  const [neueMahnstufe, setNeueMahnstufe] = useState(mahnstufe);

  async function call(action: "bezahlt" | "mahnung", body: Record<string, unknown> = {}) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/rechnung/${rechnungId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
      <h2 className="text-lg font-semibold text-warm-text">Aktionen</h2>
      {error && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {!isPaid && (
        <div className="space-y-2">
          <label className="block text-xs text-warm-muted">Zahlungsmethode</label>
          <select
            value={zahlungsMethode}
            onChange={(e) => setZahlungsMethode(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 [&>option]:bg-warm-surface [&>option]:text-warm-text"
          >
            {ZAHLUNGSMETHODEN.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            onClick={() => call("bezahlt", { zahlungsMethode })}
            disabled={submitting}
            className="w-full py-2 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? "…" : "Als bezahlt markieren"}
          </button>
        </div>
      )}

      {!isPaid && (
        <div className="space-y-2 pt-3 border-t border-warm-border">
          <label className="block text-xs text-warm-muted">Mahnstufe</label>
          <select
            value={neueMahnstufe}
            onChange={(e) => setNeueMahnstufe(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 [&>option]:bg-warm-surface [&>option]:text-warm-text"
          >
            {MAHNSTUFEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => call("mahnung", { stufe: neueMahnstufe })}
            disabled={submitting || neueMahnstufe === mahnstufe}
            className="w-full py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40 transition-colors"
          >
            Mahnstufe speichern
          </button>
        </div>
      )}

      {isPaid && (
        <div className="p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm text-center">
          ✓ Diese Rechnung ist bezahlt.
        </div>
      )}
    </section>
  );
}
