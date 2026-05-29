"use client";

import { useState } from "react";

type Action = "freigeben" | "freigeben_anmerkung" | "rueckruf" | "ablehnen";

export default function ActionPanel({ angebotId, hasPrices }: { angebotId: number; hasPrices: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAnmerkungInput, setShowAnmerkungInput] = useState(false);
  const [anmerkung, setAnmerkung] = useState("");
  const [showAblehnenInput, setShowAblehnenInput] = useState(false);
  const [ablehnenKategorie, setAblehnenKategorie] = useState("ausgebucht");
  const [ablehnenKundenText, setAblehnenKundenText] = useState("");
  const [ablehnenNotiz, setAblehnenNotiz] = useState("");
  const [ablehnenOhneMail, setAblehnenOhneMail] = useState(false);

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

  async function execAblehnen() {
    if (submitting) return;
    const msg = ablehnenOhneMail
      ? "Anfrage OHNE Mail ablehnen? Der Kunde wird NICHT benachrichtigt."
      : "Anfrage ablehnen? Der Kunde bekommt eine höfliche Absage-Mail.";
    if (!confirm(msg)) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/anfrage/${angebotId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ablehnen",
          grund_kategorie: ablehnenKategorie,
          kunden_text: ablehnenKategorie === "sonstiges" ? ablehnenKundenText : undefined,
          interne_notiz: ablehnenNotiz || undefined,
          ohne_mail: ablehnenOhneMail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
      } else {
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
          <div className="p-3 rounded-lg bg-black/30 border border-red-500/20 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Grund (bestimmt den Kundentext)</label>
              <select
                value={ablehnenKategorie}
                onChange={(e) => setAblehnenKategorie(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
              >
                <option value="ausgebucht">Termin/Artikel ausgebucht</option>
                <option value="liefergebiet">Außerhalb Liefergebiet</option>
                <option value="nicht_verfuegbar">Artikel nicht verfügbar</option>
                <option value="kurzfristig">Termin zu kurzfristig</option>
                <option value="intern">Möchte nicht vermieten (neutrale Mail)</option>
                <option value="sonstiges">Sonstiges (eigener Kundentext)</option>
              </select>
            </div>
            {ablehnenKategorie === "sonstiges" && (
              <div>
                <label className="block text-xs text-gold-300 mb-1">Dieser Text geht an den Kunden</label>
                <textarea
                  value={ablehnenKundenText}
                  onChange={(e) => setAblehnenKundenText(e.target.value)}
                  rows={2}
                  placeholder="Höflicher Absagetext für den Kunden ..."
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Interne Notiz (geht NICHT an den Kunden)</label>
              <input
                type="text"
                value={ablehnenNotiz}
                onChange={(e) => setAblehnenNotiz(e.target.value)}
                placeholder="z.B. kam komisch rüber / Testanfrage"
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={ablehnenOhneMail} onChange={(e) => setAblehnenOhneMail(e.target.checked)} />
              Ohne Mail ablehnen (Test/Spam)
            </label>
            <button
              onClick={execAblehnen}
              disabled={submitting || (ablehnenKategorie === "sonstiges" && ablehnenKundenText.trim().length < 2)}
              className="w-full py-2 rounded bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ablehnenOhneMail ? "Ablehnen ohne Mail" : "Absage senden"}
            </button>
          </div>
        )}

        {submitting && <div className="text-xs text-gray-500 text-center mt-2">Aktion wird ausgeführt …</div>}
      </div>
    </section>
  );
}
