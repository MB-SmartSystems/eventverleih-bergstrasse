"use client";

import { useState } from "react";

type Typ = "anzahlung" | "restzahlung" | "kaution";

const LABELS: Record<Typ, string> = {
  anzahlung: "Anzahlung",
  restzahlung: "Restzahlung",
  kaution: "Kaution hinterlegt",
};

export default function ZahlungsPanel({
  buchungId,
  anzahlungBezahlt,
  restzahlungBezahlt,
  kautionHinterlegt,
}: {
  buchungId: number;
  anzahlungBezahlt: string | null;
  restzahlungBezahlt: string | null;
  kautionHinterlegt: string | null;
}) {
  const [submitting, setSubmitting] = useState<Typ | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState<Record<Typ, string>>({
    anzahlung: today,
    restzahlung: today,
    kaution: today,
  });

  async function setze(typ: Typ) {
    setSubmitting(typ);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/zahlung`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ, datum: datum[typ] }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, d.detail].filter(Boolean).join(" — "));
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(null);
    }
  }

  function row(typ: Typ, current: string | null) {
    const fmt = current ? new Date(current).toLocaleDateString("de-DE") : null;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-warm-text">{LABELS[typ]}</div>
          {fmt && <div className="text-xs text-green-700">✓ erhalten am {fmt}</div>}
        </div>
        <input
          type="date"
          value={datum[typ]}
          onChange={(e) => setDatum({ ...datum, [typ]: e.target.value })}
          disabled={submitting !== null}
          className="px-2 py-1 rounded border border-warm-border bg-warm-bg text-warm-text text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <button
          onClick={() => setze(typ)}
          disabled={submitting !== null}
          className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:bg-accent-dark disabled:opacity-40"
        >
          {submitting === typ ? "…" : current ? "Update" : "Erfassen"}
        </button>
      </div>
    );
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
      <h2 className="text-lg font-semibold text-warm-text">Zahlungseingang erfassen</h2>
      {error && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      {row("anzahlung", anzahlungBezahlt)}
      {row("restzahlung", restzahlungBezahlt)}
      {row("kaution", kautionHinterlegt)}
      <p className="text-xs text-warm-muted pt-2 border-t border-warm-border">
        Anzahlung erfassen setzt den Status automatisch auf <strong>Bestaetigt</strong>.
      </p>
    </section>
  );
}
