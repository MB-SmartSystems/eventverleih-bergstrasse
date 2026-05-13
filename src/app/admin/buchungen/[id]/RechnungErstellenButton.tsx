"use client";

import { useState } from "react";

export default function RechnungErstellenButton({
  buchungId,
  hasPrice,
  alreadyHasRechnung,
}: {
  buchungId: number;
  hasPrice: boolean;
  alreadyHasRechnung: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ rechnungsnummer: string; url: string } | null>(null);

  async function exec() {
    if (alreadyHasRechnung) {
      if (!confirm("Es gibt schon eine Rechnung für diese Buchung. Trotzdem eine weitere erstellen?")) return;
    }
    if (!hasPrice) {
      setError("Keine Preise gesetzt — Rechnung würde 0 € lauten. Bitte erst in Baserow Preise eintragen.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/rechnung-erstellen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(msg || `HTTP ${res.status}`);
      } else {
        setCreated({ rechnungsnummer: data.rechnungsnummer, url: data.url });
        // Reload nach 2.5s damit n8n den PDF-Render starten kann
        setTimeout(() => window.location.reload(), 2500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <section className="p-5 rounded-xl bg-green-50 border border-green-200 text-sm">
        <div className="text-green-800 font-medium">✓ Rechnung {created.rechnungsnummer} erstellt</div>
        <div className="text-green-700 text-xs mt-1">PDF wird gerade gerendert und per Mail gesendet …</div>
        <a href={created.url} target="_blank" rel="noreferrer" className="text-xs text-green-700 underline mt-2 block">
          Web-Ansicht öffnen
        </a>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <h2 className="text-lg font-semibold text-warm-text mb-3">Rechnung</h2>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      <button
        onClick={exec}
        disabled={submitting}
        className="w-full py-3 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Wird erstellt …" : alreadyHasRechnung ? "Weitere Rechnung erstellen" : "Rechnung erstellen + Mail senden"}
      </button>
      <p className="text-xs text-warm-muted mt-2">
        Komplettrechnung mit PDF-Anhang an die Kunden-Mail. Web-Ansicht zusätzlich verlinkt.
      </p>
    </section>
  );
}
