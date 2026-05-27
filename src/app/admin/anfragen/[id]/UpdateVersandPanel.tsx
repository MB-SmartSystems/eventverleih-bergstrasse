"use client";

import { useState } from "react";

export default function UpdateVersandPanel({
  angebotId,
  snapshotVersion,
  snapshotErstelltAm,
  akzeptVersion,
  diffs,
}: {
  angebotId: number;
  snapshotVersion: number;
  snapshotErstelltAm: string | null;
  akzeptVersion: number;
  diffs: string[];
}) {
  const [showInput, setShowInput] = useState(false);
  const [anmerkung, setAnmerkung] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!confirm(`Soll Version ${snapshotVersion + 1} an den Kunden gesendet werden?`)) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/angebot/${angebotId}/neue-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anmerkung: anmerkung.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) setError([d.error, d.detail].filter(Boolean).join(" — "));
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  const fmtTime = snapshotErstelltAm
    ? new Date(snapshotErstelltAm).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  if (snapshotVersion === 0) {
    return null; // noch nichts versendet — Snapshot-Logik greift erst nach Freigabe
  }

  const hasDiffs = diffs.length > 0;
  return (
    <section
      className={
        "p-5 rounded-xl border " +
        (hasDiffs ? "bg-yellow-500/10 border-yellow-500/40" : "bg-white/5 border-white/10")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Versendet: Version {snapshotVersion}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Letzter Versand: {fmtTime}
            {akzeptVersion > 0 && (
              <>
                {" "}
                · Akzeptiert: Version {akzeptVersion}
              </>
            )}
          </p>
        </div>
      </div>

      {hasDiffs ? (
        <>
          <div className="mt-4">
            <p className="text-xs text-yellow-200 font-semibold uppercase tracking-wide mb-2">
              Änderungen gegenüber Kundenansicht:
            </p>
            <ul className="text-sm text-yellow-100 space-y-1 list-disc list-inside">
              {diffs.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
          )}

          <a
            href={`/admin/angebot/${angebotId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full py-2 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-center text-gray-200 text-sm font-medium transition-colors"
          >
            Vorschau in neuem Tab öffnen
          </a>
          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              disabled={submitting}
              className="mt-2 w-full py-2 rounded bg-yellow-500 hover:bg-yellow-400 text-yellow-950 text-sm font-medium disabled:opacity-40"
            >
              Neue Version (v{snapshotVersion + 1}) an Kunde senden
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <textarea
                rows={3}
                value={anmerkung}
                onChange={(e) => setAnmerkung(e.target.value)}
                placeholder="Optionale Anmerkung in der Update-Mail (z.B. 'Termin auf Wunsch verlängert')"
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-gold-500/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={send}
                  disabled={submitting}
                  className="flex-1 py-2 rounded bg-yellow-500 hover:bg-yellow-400 text-yellow-950 text-sm font-medium disabled:opacity-40"
                >
                  {submitting ? "Sende …" : `Senden als v${snapshotVersion + 1}`}
                </button>
                <button
                  onClick={() => {
                    setShowInput(false);
                    setAnmerkung("");
                  }}
                  disabled={submitting}
                  className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-sm border border-white/10"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-green-300 mt-2">
          ✓ Kundenansicht ist synchron mit dem aktuellen Buchungsstand.
        </p>
      )}
    </section>
  );
}
