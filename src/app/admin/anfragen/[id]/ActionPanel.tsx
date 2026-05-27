"use client";

import { useState } from "react";

type Action = "freigeben" | "freigeben_anmerkung" | "rueckruf" | "ablehnen";

export default function ActionPanel({ angebotId, hasPrices }: { angebotId: number; hasPrices: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAnmerkungInput, setShowAnmerkungInput] = useState(false);
  const [anmerkung, setAnmerkung] = useState("");
  const [showAblehnenInput, setShowAblehnenInput] = useState(false);
  const [ablehnenGrund, setAblehnenGrund] = useState("");

  async function exec(action: Action, anmerkungText?: string) {
    if (submitting) return;
    if ((action === "freigeben" || action === "freigeben_anmerkung") && !hasPrices) {
      if (!confirm("Es sind keine Preise gesetzt. Trotzdem freigeben? (Kunde sieht leere Preisübersicht)")) return;
    }
    if (action === "ablehnen" && !confirm("Anfrage wirklich ablehnen? Kunde bekommt höfliche Absage-Mail.")) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/anfrage/${angebotId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, anmerkung: anmerkungText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
      } else {
        // Reload page
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-white/5 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Aktion wählen</h2>
      {error && (
        <div className="mb-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
      )}
      <div className="space-y-2">
        <button
          onClick={() => exec("freigeben")}
          disabled={submitting}
          className="w-full py-3 px-4 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-200 text-sm font-medium transition-all disabled:opacity-50 text-left flex items-center gap-3"
        >
          <span>✓</span>
          <span>Angebot freigeben + Mail senden</span>
        </button>

        <button
          onClick={() => setShowAnmerkungInput(!showAnmerkungInput)}
          disabled={submitting}
          className="w-full py-3 px-4 rounded-lg bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 text-gold-200 text-sm font-medium transition-all disabled:opacity-50 text-left flex items-center gap-3"
        >
          <span>Mit Anmerkung freigeben{showAnmerkungInput ? " — Formular ausblenden" : ""}</span>
        </button>

        {showAnmerkungInput && (
          <div className="p-3 rounded-lg bg-black/30 border border-gold-500/20 space-y-2">
            <textarea
              value={anmerkung}
              onChange={(e) => setAnmerkung(e.target.value)}
              rows={4}
              placeholder="Persönliche Anmerkung (wird in die Angebots-Mail oben eingefügt) ..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-500/50 resize-none"
            />
            <button
              onClick={() => exec("freigeben_anmerkung", anmerkung)}
              disabled={submitting || anmerkung.trim().length < 2}
              className="w-full py-2 rounded bg-gold-500 hover:bg-gold-400 text-navy-900 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Senden mit Anmerkung
            </button>
          </div>
        )}

        <button
          onClick={() => exec("rueckruf")}
          disabled={submitting}
          className="w-full py-3 px-4 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-200 text-sm font-medium transition-all disabled:opacity-50 text-left flex items-center gap-3"
        >
          <span>Rückruf vorschlagen</span>
        </button>

        <button
          onClick={() => setShowAblehnenInput(!showAblehnenInput)}
          disabled={submitting}
          className="w-full py-3 px-4 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-sm font-medium transition-all disabled:opacity-50 text-left flex items-center gap-3"
        >
          <span>✗</span>
          <span>Ablehnen (höfliche Absage){showAblehnenInput ? " — Formular ausblenden" : ""}</span>
        </button>

        {showAblehnenInput && (
          <div className="p-3 rounded-lg bg-black/30 border border-red-500/20 space-y-2">
            <textarea
              value={ablehnenGrund}
              onChange={(e) => setAblehnenGrund(e.target.value)}
              rows={3}
              placeholder="Grund (optional, wird in die Absage-Mail eingefügt) — z.B. „Urlaubsbedingt können wir die Anfrage leider nicht annehmen.“"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 resize-none"
            />
            <button
              onClick={() => exec("ablehnen", ablehnenGrund)}
              disabled={submitting}
              className="w-full py-2 rounded bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              Absage senden
            </button>
          </div>
        )}

        {submitting && <div className="text-xs text-gray-500 text-center mt-2">Aktion wird ausgeführt …</div>}
      </div>
    </section>
  );
}
