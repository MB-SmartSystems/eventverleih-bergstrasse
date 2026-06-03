"use client";

/**
 * Packliste — abhakbare Artikel-Liste direkt im Übergabe-Bereich (Handy-tauglich).
 * Persistiert pro Position über dasselbe Backend wie die Checkliste
 * (POST /api/admin/buchung/[id]/checklist, item_type "pack" → Position.Eingepackt).
 */
import { useState } from "react";

interface PackItem {
  positionId: number;
  label: string;
  checked: boolean;
}

export default function PackListe({ buchungId, packItems }: { buchungId: number; packItems: PackItem[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(packItems.map((p) => [String(p.positionId), p.checked])),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(positionId: number, current: boolean) {
    const key = String(positionId);
    setPending(key);
    setError("");
    const next = !current;
    setState((p) => ({ ...p, [key]: next }));
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: key, checked: next, item_type: "pack" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `HTTP ${res.status}`);
        setState((p) => ({ ...p, [key]: current }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setState((p) => ({ ...p, [key]: current }));
    } finally {
      setPending(null);
    }
  }

  if (packItems.length === 0) return null;
  const done = packItems.filter((p) => state[String(p.positionId)]).length;

  return (
    <div className="rounded-lg border border-warm-border bg-warm-bg/40 p-3">
      <p className="text-sm font-medium text-warm-text mb-2">
        Packliste <span className="text-xs text-warm-muted">{done}/{packItems.length}</span>
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-1">
        {packItems.map((p) => {
          const checked = !!state[String(p.positionId)];
          return (
            <button
              key={p.positionId}
              onClick={() => toggle(p.positionId, checked)}
              disabled={pending === String(p.positionId)}
              className={`w-full flex items-center gap-2 text-left text-sm py-1 disabled:opacity-50 ${
                checked ? "text-warm-text" : "text-warm-muted hover:text-warm-text"
              }`}
            >
              <span className={`inline-block w-5 text-base ${checked ? "text-green-600" : "text-gray-400"}`}>
                {checked ? "✓" : "○"}
              </span>
              <span className={checked ? "line-through" : ""}>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
