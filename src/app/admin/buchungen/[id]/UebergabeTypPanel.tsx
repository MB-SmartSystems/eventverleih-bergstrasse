"use client";

import { useState } from "react";

const OPTIONEN: Array<{ value: string; label: string }> = [
  { value: "Standard", label: "Standard (Grillhütte Alsbach-Hähnlein)" },
  { value: "Beim_Kunden", label: "Beim Kunden (Lieferadresse)" },
  { value: "Lieferung", label: "Lieferung (Manuel bringt)" },
];

export default function UebergabeTypPanel({
  buchungId,
  currentTyp,
}: {
  buchungId: number;
  currentTyp: string | null;
}) {
  const [typ, setTyp] = useState(currentTyp ?? "Standard");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/uebergabe-typ`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Fehler beim Speichern");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="text-warm-muted">Übergabe-Typ:</span>
      <select
        value={typ}
        onChange={(e) => setTyp(e.target.value)}
        disabled={saving}
        className="px-2 py-1 rounded border border-warm-border bg-warm-bg text-warm-text text-xs focus:outline-none focus:ring-1 focus:ring-accent/40 [&>option]:bg-warm-surface [&>option]:text-warm-text"
      >
        {OPTIONEN.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="px-3 py-1 rounded bg-accent text-white text-xs hover:bg-accent/80 disabled:opacity-50"
      >
        {saving ? "…" : "Setzen"}
      </button>
      {saved && <span className="text-green-600">✓</span>}
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
