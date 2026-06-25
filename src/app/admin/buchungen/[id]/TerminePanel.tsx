"use client";

import { useState } from "react";

export default function TerminePanel({
  buchungId,
  uebergabeInitial,
  rueckgabeInitial,
  calendarIdUebergabe,
  calendarIdRueckgabe,
}: {
  buchungId: number;
  uebergabeInitial: string | null;
  rueckgabeInitial: string | null;
  calendarIdUebergabe: string | null;
  calendarIdRueckgabe: string | null;
}) {
  // ISO-Datetime → local datetime-input-Format yyyy-MM-ddTHH:mm
  function toInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const [uebergabe, setUebergabe] = useState(toInput(uebergabeInitial));
  const [rueckgabe, setRueckgabe] = useState(toInput(rueckgabeInitial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setSubmitting(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/termin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uebergabe_termin: uebergabe ? new Date(uebergabe).toISOString() : "",
          rueckgabe_termin: rueckgabe ? new Date(rueckgabe).toISOString() : "",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError([d.error, d.detail].filter(Boolean).join(" — "));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-warm-text">Termine</h2>
        <span className="text-xs text-warm-muted">Treffpunkt: Grillhütte Sandwiese</span>
      </div>
      <p className="text-xs text-warm-muted">
        Trage hier den telefonisch abgestimmten Termin ein. Beim Speichern wird <strong>nur der neu
        gesetzte oder geänderte</strong> Termin per Mail an den Kunden bestätigt — eine bereits erfolgte
        Übergabe wird nicht erneut gemailt. Der Termin wird automatisch in den Google-Kalender übernommen.
      </p>
      {error && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
      {saved && <div className="p-2 rounded bg-green-50 border border-green-200 text-green-700 text-xs">Termine gespeichert.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-warm-muted mb-1">Übergabe-Termin</label>
          <input
            type="datetime-local"
            step={1800}
            value={uebergabe}
            onChange={(e) => setUebergabe(e.target.value)}
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {calendarIdUebergabe && (
            <p className="text-[10px] text-warm-muted mt-0.5">Calendar-Event: {calendarIdUebergabe.slice(0, 12)}…</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-warm-muted mb-1">Rückgabe-Termin</label>
          <input
            type="datetime-local"
            step={1800}
            value={rueckgabe}
            onChange={(e) => setRueckgabe(e.target.value)}
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {calendarIdRueckgabe && (
            <p className="text-[10px] text-warm-muted mt-0.5">Calendar-Event: {calendarIdRueckgabe.slice(0, 12)}…</p>
          )}
        </div>
      </div>
      <button
        onClick={save}
        disabled={submitting}
        className="px-4 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40"
      >
        {submitting ? "Speichere…" : "Termine speichern + Mail senden"}
      </button>
    </section>
  );
}
