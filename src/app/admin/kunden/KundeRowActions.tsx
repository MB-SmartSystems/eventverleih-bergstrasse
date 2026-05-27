"use client";

import { useState } from "react";

export default function KundeRowActions({ kundeId, kundeName, buchungCount }: { kundeId: number; kundeName: string; buchungCount: number }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function del() {
    if (buchungCount > 0) {
      setError(`Kunde hat noch ${buchungCount} Buchungen. Bitte erst die Buchungen verarbeiten/löschen.`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/kunde/${kundeId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError([d.error, d.detail].filter(Boolean).join(" — "));
        setSubmitting(false);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="text-xs text-warm-muted hover:text-red-600"
        title="Kunde löschen"
      >
        ×
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !submitting && setOpen(false)}>
          <div className="bg-white rounded-lg p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Kunde löschen?</h3>
            <p className="text-sm text-gray-600 mb-3">
              Sie wollen <strong>{kundeName}</strong> dauerhaft löschen?
              {buchungCount > 0 ? (
                <span className="block mt-2 text-red-700 text-xs">
                  Achtung: Kunde hat {buchungCount} Buchung(en) — Löschen wird blockiert.
                </span>
              ) : (
                <span className="block mt-2 text-gray-500 text-xs">
                  DSGVO-Löschung wird im Audit-Log dokumentiert. Vorgang ist unwiderruflich.
                </span>
              )}
            </p>
            {error && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-1 py-2 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={del}
                disabled={submitting || buchungCount > 0}
                className="flex-1 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40"
              >
                {submitting ? "Lösche…" : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
