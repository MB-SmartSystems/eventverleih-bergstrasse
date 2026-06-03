"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Sperrzeit {
  id: number;
  von: string;
  bis: string;
  grund: string;
}

function fmt(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

export default function SperrzeitForm({ initial }: { initial: Sperrzeit[] }) {
  const router = useRouter();
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [grund, setGrund] = useState("Urlaub");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (!von || !bis) {
      setError("Bitte Von und Bis angeben.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sperrzeiten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ von, bis, grund: grund.trim() || "Urlaub" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, d.detail].filter(Boolean).join(" — "));
      } else {
        setVon("");
        setBis("");
        setGrund("Urlaub");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/sperrzeiten?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `HTTP ${res.status}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      {error && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Neue Sperrzeit */}
      <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
        <h2 className="text-lg font-semibold text-warm-text">Neue Sperrzeit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-warm-muted mb-1">Von</label>
            <input
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
              className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-muted mb-1">Bis</label>
            <input
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-warm-muted mb-1">Grund</label>
          <input
            type="text"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            placeholder="z. B. Urlaub"
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <button
          onClick={add}
          disabled={busy}
          className="px-4 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40"
        >
          {busy ? "…" : "Sperrzeit hinzufügen"}
        </button>
      </section>

      {/* Liste */}
      <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
        <h2 className="text-lg font-semibold text-warm-text mb-3">Eingetragene Sperrzeiten</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-warm-muted">Keine Sperrzeiten eingetragen.</p>
        ) : (
          <div className="space-y-2">
            {initial.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-warm-border">
                <div className="text-sm">
                  <span className="font-medium text-warm-text">
                    {fmt(s.von)} – {fmt(s.bis)}
                  </span>
                  <span className="text-warm-muted ml-2">{s.grund}</span>
                </div>
                <button
                  onClick={() => remove(s.id)}
                  disabled={busy}
                  className="text-xs text-red-600 hover:underline disabled:opacity-40"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
