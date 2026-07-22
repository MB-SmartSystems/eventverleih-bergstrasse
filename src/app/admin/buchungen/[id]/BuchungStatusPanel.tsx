"use client";

/**
 * Status-Panel — readonly Anzeige + Notfall-Override.
 *
 * Plan Phase 5 B1: kein freier Status-Dropdown mehr. Statuswechsel passieren via Auto-Trigger
 * (Stripe-Webhook, "Angebot freigeben"-Action) oder via Action-Buttons (Uebergabe bestaetigen,
 * Rueckgabe bestaetigen, Stornieren — siehe page.tsx).
 *
 * Dieses Panel zeigt nur den aktuellen Status + erlaubt manuellen Override als Notfall-Klappe.
 */
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

const STATUS_LABEL: Record<string, string> = {
  Anfrage: "Anfrage offen",
  Angebot_erstellt: "Angebot erstellt",
  Angebot_versendet: "Angebot an Kunde versendet",
  Reserviert: "Reserviert (Anzahlung eingegangen)",
  Bestaetigt: "Vom Kunden bestaetigt (Anzahlung steht aus)",
  Uebergeben: "Artikel uebergeben",
  In_Miete: "Aktuell in Miete",
  Zurueckgegeben: "Zurückgegeben — Prüfung läuft",
  Abgerechnet: "Abgerechnet",
  Storniert: "Storniert",
  No_Show: "Kunde nicht erschienen",
};

const STATUS_TONE: Record<string, string> = {
  Anfrage: "bg-blue-50 border-blue-200 text-blue-800",
  Angebot_erstellt: "bg-blue-50 border-blue-200 text-blue-800",
  Angebot_versendet: "bg-yellow-50 border-yellow-200 text-yellow-800",
  Reserviert: "bg-green-50 border-green-200 text-green-800",
  Bestaetigt: "bg-amber-50 border-amber-200 text-amber-800",
  Uebergeben: "bg-purple-50 border-purple-200 text-purple-800",
  In_Miete: "bg-purple-50 border-purple-200 text-purple-800",
  Zurueckgegeben: "bg-cyan-50 border-cyan-200 text-cyan-800",
  Abgerechnet: "bg-gray-50 border-gray-200 text-gray-700",
  Storniert: "bg-red-50 border-red-200 text-red-700",
  No_Show: "bg-red-50 border-red-200 text-red-700",
};

export default function BuchungStatusPanel({
  buchungId,
  currentStatus,
}: {
  buchungId: number;
  currentStatus: string;
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const label = STATUS_LABEL[currentStatus] || currentStatus.replace(/_/g, " ");
  const tone = STATUS_TONE[currentStatus] || "bg-gray-50 border-gray-200 text-gray-700";

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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-warm-text">Status</h2>
        <button
          onClick={() => setShowOverride(!showOverride)}
          className="text-xs text-warm-muted hover:text-warm-text underline"
        >
          {showOverride ? "Override schließen" : "Notfall-Override"}
        </button>
      </div>
      <div className={`p-3 rounded-lg border ${tone}`}>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs opacity-70 mt-0.5 font-mono">{currentStatus}</div>
      </div>
      <p className="text-xs text-warm-muted mt-3">
        Status wird normalerweise <strong>automatisch</strong> gesetzt — durch Auto-Trigger (Stripe-Webhook,
        Angebot freigeben) oder die Action-Buttons unten (Uebergabe bestaetigen, Rueckgabe bestaetigen,
        Stornieren).
      </p>
      {showOverride && (
        <div className="mt-3 pt-3 border-t border-warm-border space-y-2">
          <p className="text-xs text-red-700 font-medium">
            Manueller Override — nur im Notfall verwenden, wenn Auto-Logik streikt.
          </p>
          {error && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 [&>option]:bg-warm-surface [&>option]:text-warm-text"
          >
            {STATI.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] || s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={submitting || status === currentStatus}
            className="w-full py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Speichern…" : "Override speichern (mit Audit-Log)"}
          </button>
        </div>
      )}
    </section>
  );
}
