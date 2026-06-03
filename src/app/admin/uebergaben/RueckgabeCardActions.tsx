"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RuecknahmeDialog from "../buchungen/[id]/RuecknahmeDialog";

interface Position {
  id: number;
  name: string;
  anzahl: number;
}

function toInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RueckgabeCardActions({
  buchungId,
  positionen,
  rueckgabeInitial,
}: {
  buchungId: number;
  positionen: Position[];
  rueckgabeInitial: string | null;
}) {
  const router = useRouter();
  const [rueckgabe, setRueckgabe] = useState(toInput(rueckgabeInitial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function saveTermin() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/termin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rueckgabe_termin: rueckgabe ? new Date(rueckgabe).toISOString() : "" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError([d.error, d.detail].filter(Boolean).join(" — "));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div>
        <label className="block text-xs text-warm-muted mb-1">Rückgabe-Termin vereinbaren</label>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            step={1800}
            value={rueckgabe}
            onChange={(e) => setRueckgabe(e.target.value)}
            className="flex-1 px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            onClick={saveTermin}
            disabled={saving}
            className="px-3 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40"
          >
            {saving ? "…" : "Speichern"}
          </button>
        </div>
        {saved && <p className="text-xs text-green-700 mt-1">Termin gespeichert → Google-Kalender.</p>}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <RuecknahmeDialog buchungId={buchungId} positionen={positionen} />
    </div>
  );
}
