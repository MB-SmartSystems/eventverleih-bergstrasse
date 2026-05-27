"use client";

import { useState } from "react";

type Action = "voll" | "teil" | "einzug";

export default function KautionErstattenPanel({
  buchungId,
  kautionSollEur,
  prueffristBis,
  hasStripeHold,
}: {
  buchungId: number;
  kautionSollEur: number;
  prueffristBis: string | null;
  hasStripeHold: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action>("voll");
  const [schadenEur, setSchadenEur] = useState("");
  const [notiz, setNotiz] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/kaution-erstatten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          schaden_eur: action === "teil" ? parseFloat(schadenEur) : undefined,
          schaden_notiz: notiz.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
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

  const fristText = prueffristBis ? new Date(prueffristBis).toLocaleDateString("de-DE") : null;

  return (
    <section className="p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-amber-900">Kaution-Prüfung offen</h2>
        <p className="text-sm text-amber-800/90 mt-1">
          Prüfe die Artikel auf Schäden. Erstatte oder behalte die Kaution dann ein.
          {fristText && <> Prüffrist bis <strong>{fristText}</strong>.</>}
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Kaution gesamt: <strong>{kautionSollEur.toFixed(2)} €</strong>
          {hasStripeHold && <span> · Stripe-Hold aktiv (Pre-Auth)</span>}
        </p>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded bg-amber-700 text-white text-sm font-medium hover:bg-amber-800"
        >
          Kaution erstatten / einbehalten
        </button>
      ) : (
        <div className="space-y-3 p-4 rounded-lg bg-white border border-amber-200">
          {error && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

          <div className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="kaution_action"
                checked={action === "voll"}
                onChange={() => setAction("voll")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Volle Erstattung (kein Schaden)</div>
                <div className="text-xs text-gray-500">
                  {hasStripeHold ? "Stripe-Hold wird freigegeben — 0 € Gebühr." : "Kaution wird zurückerstattet."}
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="kaution_action"
                checked={action === "teil"}
                onChange={() => setAction("teil")}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Teilerstattung — Schaden eingezogen</div>
                <div className="text-xs text-gray-500">Schaden-Betrag wird einbehalten, Rest erstattet.</div>
                {action === "teil" && (
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={kautionSollEur - 0.01}
                    value={schadenEur}
                    onChange={(e) => setSchadenEur(e.target.value)}
                    placeholder={`Schaden in € (max ${(kautionSollEur - 0.01).toFixed(2)})`}
                    className="mt-2 w-40 px-2 py-1 rounded border border-gray-300 text-sm"
                  />
                )}
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="kaution_action"
                checked={action === "einzug"}
                onChange={() => setAction("einzug")}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Kompletter Einzug (Schaden &gt;= Kaution)</div>
                <div className="text-xs text-gray-500">Gesamte Kaution wird einbehalten.</div>
              </div>
            </label>
          </div>

          {(action === "teil" || action === "einzug") && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Schaden-Notiz (geht an Kunden in der Mail)</label>
              <textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={2}
                placeholder="z.B. „Stuhl-Lehne gebrochen, 1 Faltzelt-Plane gerissen — Foto in WhatsApp folgt"
                className="w-full px-2 py-1 rounded border border-gray-300 text-sm resize-none"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-amber-200">
            <button
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="px-3 py-2 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={submit}
              disabled={submitting || (action === "teil" && (!schadenEur || parseFloat(schadenEur) <= 0))}
              className="flex-1 py-2 rounded bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-40"
            >
              {submitting ? "Verarbeite…" : "Kaution auflösen + Mail an Kunde"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
