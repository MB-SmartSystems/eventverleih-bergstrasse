"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StornoDialogProps {
  buchungId: number;
  eventDatum: string | null;
  bezahltEur: number;
  stripeIntentId?: string;
  // Settings vom Server vorberechnet
  defaultErstattungEur: number;
  tageBisEvent: number;
  quote: number;
}

const GRUENDE = [
  "Kunden_Wunsch",
  "Manuel_Entscheidung",
  "Anzahlung_nicht_geleistet",
  "Konflikt_verloren",
  "No_Show",
  "Sonstig",
] as const;

export default function StornoDialog({
  buchungId,
  bezahltEur,
  stripeIntentId,
  defaultErstattungEur,
  tageBisEvent,
  quote,
}: StornoDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [grund, setGrund] = useState<(typeof GRUENDE)[number]>("Kunden_Wunsch");
  const [erstattungEur, setErstattungEur] = useState(defaultErstattungEur);
  const [refundViaStripe, setRefundViaStripe] = useState(!!stripeIntentId);
  const [notiz, setNotiz] = useState("");

  async function handleSubmit() {
    if (
      !confirm(
        `Buchung wirklich stornieren?\nGrund: ${grund}\nErstattung: ${erstattungEur} €${
          refundViaStripe ? " (via Stripe-Refund)" : ""
        }`,
      )
    )
      return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storno_grund: grund,
          erstattung_eur: erstattungEur,
          refund_via_stripe: refundViaStripe,
          stripe_payment_intent_id: stripeIntentId,
          notiz,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "submit failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 text-red-700 px-3 py-1.5 text-sm hover:bg-red-100"
      >
        Stornieren
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-warm-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="border-b border-warm-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-display font-semibold text-red-700">Storno Buchung #{buchungId}</h2>
          <button onClick={() => setOpen(false)} className="text-warm-muted">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Erstattungs-Berechnung */}
          <div className="rounded-lg bg-warm-bg/60 p-3 text-sm">
            <p className="text-warm-muted">Erstattungs-Vorschlag aus Storno-Policy:</p>
            <p className="text-warm-text mt-1">
              {tageBisEvent} Tage bis Event → <strong>{(quote * 100).toFixed(0)}% Erstattung</strong>
            </p>
            <p className="text-warm-muted text-xs">
              Bezahlt: {bezahltEur} € · Vorschlag: {defaultErstattungEur} €
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Grund</label>
            <select
              value={grund}
              onChange={(e) => setGrund(e.target.value as (typeof GRUENDE)[number])}
              className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-bg text-warm-text text-sm [&>option]:bg-warm-surface [&>option]:text-warm-text"
            >
              {GRUENDE.map((g) => (
                <option key={g} value={g}>
                  {g.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Erstattung in EUR</label>
            <input
              type="number"
              step="0.01"
              value={erstattungEur}
              onChange={(e) => setErstattungEur(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-warm-border text-sm"
            />
            <p className="text-xs text-warm-muted mt-1">
              Vorschlag {defaultErstattungEur} € — überschreibbar wenn nötig
            </p>
          </div>

          {stripeIntentId && (
            <label className="flex items-center gap-2 text-sm text-warm-text">
              <input
                type="checkbox"
                checked={refundViaStripe}
                onChange={(e) => setRefundViaStripe(e.target.checked)}
                className="w-5 h-5 rounded border-warm-border text-accent"
              />
              Stripe-Refund auslösen ({stripeIntentId.slice(0, 20)}…)
            </label>
          )}

          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Notiz</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-warm-border text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-warm-border p-4 flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-warm-border text-warm-text"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Storniere..." : "Stornieren"}
          </button>
        </div>
      </div>
    </div>
  );
}
