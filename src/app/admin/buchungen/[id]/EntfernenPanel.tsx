"use client";

import { useState } from "react";

type Position = { id: number; name: string };
type Service = { key: string; label: string; eur: number };

/**
 * Backoffice: einzelne Artikel-Position oder gebuchten Service nachträglich aus der Buchung
 * entfernen. Ruft die jeweilige API, danach recalc (serverseitig) → Reload zeigt neue Beträge.
 * Service-Entfernen kann bei bereits bezahlter Buchung ein Guthaben erzeugen (Rückzahlung offen).
 */
export default function EntfernenPanel({
  buchungId,
  positionen,
  services,
}: {
  buchungId: number;
  positionen: Position[];
  services: Service[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (positionen.length === 0 && services.length === 0) return null;

  async function entfernePosition(p: Position) {
    if (!confirm(`„${p.name}" wirklich aus der Buchung entfernen? Beträge werden neu berechnet.`)) return;
    setBusy(`pos-${p.id}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/position/${p.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buchungId }),
      });
      const data = await res.json();
      if (!res.ok) setError([data.error, data.detail].filter(Boolean).join(" — ") || `HTTP ${res.status}`);
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(null);
    }
  }

  async function entferneService(s: Service) {
    if (!confirm(`„${s.label}" (${s.eur.toFixed(2)} €) entfernen? Beträge werden neu berechnet; bei bereits bezahlter Buchung entsteht ein Guthaben.`)) return;
    setBusy(`svc-${s.key}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/service-entfernen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: s.key }),
      });
      const data = await res.json();
      if (!res.ok) setError([data.error, data.detail].filter(Boolean).join(" — ") || `HTTP ${res.status}`);
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 pt-3 border-t border-warm-border">
      <p className="text-xs uppercase tracking-wide text-warm-muted mb-2">Position / Leistung entfernen</p>
      {error && (
        <div className="mb-2 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      <div className="space-y-1.5">
        {positionen.map((p) => (
          <div key={`pos-${p.id}`} className="flex items-center justify-between text-sm">
            <span className="text-warm-text">{p.name}</span>
            <button
              onClick={() => entfernePosition(p)}
              disabled={busy !== null}
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              {busy === `pos-${p.id}` ? "…" : "Entfernen"}
            </button>
          </div>
        ))}
        {services.map((s) => (
          <div key={`svc-${s.key}`} className="flex items-center justify-between text-sm">
            <span className="text-warm-text">{s.label} <span className="text-warm-muted">({s.eur.toFixed(2)} €)</span></span>
            <button
              onClick={() => entferneService(s)}
              disabled={busy !== null}
              className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              {busy === `svc-${s.key}` ? "…" : "Entfernen"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
