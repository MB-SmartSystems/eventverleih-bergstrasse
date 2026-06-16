"use client";

/**
 * Status-bewusste Schnell-Aktionen direkt in der Anfragen-Liste — ohne ins Detail
 * klicken zu müssen. Ruft dieselben Endpoints wie das Detail-ActionPanel:
 *   - /api/admin/anfrage/[id]/action      (freigeben | freigeben_anmerkung | rueckruf | ablehnen)
 *   - /api/admin/angebot/[id]/nachhaken   (Erinnerung bei offenem Angebot)
 *   - /api/admin/angebot/[id]/erneut-senden
 *
 * Buttons je Status:
 *   Anfrage / Angebot_erstellt  → Freigeben · Mit Anmerkung · Rückruf · Ablehnen
 *   Angebot_versendet           → Nachhaken · Erneut senden · Ablehnen
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Expander = null | "anmerkung" | "ablehnen";

export default function AnfrageQuickActions({
  angebotId,
  status,
}: {
  angebotId: number | null;
  status: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [expander, setExpander] = useState<Expander>(null);
  const [anmerkung, setAnmerkung] = useState("");
  const [ablehnenKategorie, setAblehnenKategorie] = useState("ausgebucht");
  const [ablehnenNotiz, setAblehnenNotiz] = useState("");
  const [ablehnenOhneMail, setAblehnenOhneMail] = useState(false);

  // Ohne verknüpftes Angebot greifen die Endpoints nicht — dann kein Schnell-Aktions-UI.
  if (!angebotId) return null;

  async function post(url: string, payload: Record<string, unknown>, okMsg: string, refresh: boolean) {
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setExpander(null);
        setDone(okMsg);
        if (refresh) router.refresh(); // Status-ändernde Aktionen: Karte fällt aus der Liste
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  const actionUrl = `/api/admin/anfrage/${angebotId}/action`;
  const isVersendet = status === "Angebot_versendet";

  if (done) {
    return (
      <div className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-xs">
        ✓ {done} <span className="opacity-70">— Mail läuft im Hintergrund raus.</span>
      </div>
    );
  }

  const btn =
    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 border";

  return (
    <div className="mt-3 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
      {error && (
        <div className="mb-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {isVersendet ? (
          <>
            <button
              disabled={submitting}
              onClick={() =>
                post(`/api/admin/angebot/${angebotId}/nachhaken`, {}, "Nachhak-Mail gesendet", false)
              }
              className={`${btn} bg-gold-500/20 hover:bg-gold-500/30 border-gold-500/30 text-gold-200`}
            >
              Nachhaken
            </button>
            <button
              disabled={submitting}
              onClick={() =>
                post(`/api/admin/angebot/${angebotId}/erneut-senden`, {}, "Angebot erneut gesendet", false)
              }
              className={`${btn} bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-200`}
            >
              Erneut senden
            </button>
          </>
        ) : (
          <>
            <button
              disabled={submitting}
              onClick={() => post(actionUrl, { action: "freigeben" }, "Angebot freigegeben", true)}
              className={`${btn} bg-green-500/20 hover:bg-green-500/30 border-green-500/30 text-green-200`}
            >
              ✓ Freigeben
            </button>
            <button
              disabled={submitting}
              onClick={() => setExpander(expander === "anmerkung" ? null : "anmerkung")}
              className={`${btn} bg-gold-500/10 hover:bg-gold-500/20 border-gold-500/30 text-gold-200`}
            >
              Mit Anmerkung
            </button>
            <button
              disabled={submitting}
              onClick={() => post(actionUrl, { action: "rueckruf" }, "Rückruf vorgeschlagen", true)}
              className={`${btn} bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-200`}
            >
              Rückruf
            </button>
          </>
        )}
        <button
          disabled={submitting}
          onClick={() => setExpander(expander === "ablehnen" ? null : "ablehnen")}
          className={`${btn} bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-200`}
        >
          ✗ Ablehnen
        </button>
      </div>

      {expander === "anmerkung" && (
        <div className="mt-2 p-3 rounded-lg bg-black/30 border border-gold-500/20 space-y-2">
          <textarea
            value={anmerkung}
            onChange={(e) => setAnmerkung(e.target.value)}
            rows={3}
            placeholder="Persönliche Anmerkung (wird oben in die Angebots-Mail eingefügt) ..."
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-500/50 resize-none"
          />
          <button
            disabled={submitting || anmerkung.trim().length < 2}
            onClick={() =>
              post(actionUrl, { action: "freigeben_anmerkung", anmerkung }, "Angebot mit Anmerkung freigegeben", true)
            }
            className="w-full py-2 rounded bg-gold-500 hover:bg-gold-400 text-navy-900 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Senden mit Anmerkung
          </button>
        </div>
      )}

      {expander === "ablehnen" && (
        <div className="mt-2 p-3 rounded-lg bg-black/30 border border-red-500/20 space-y-2">
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
          </select>
          <input
            type="text"
            value={ablehnenNotiz}
            onChange={(e) => setAblehnenNotiz(e.target.value)}
            placeholder="Interne Notiz (geht NICHT an den Kunden)"
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={ablehnenOhneMail}
              onChange={(e) => setAblehnenOhneMail(e.target.checked)}
            />
            Ohne Mail ablehnen (Test/Spam)
          </label>
          <button
            disabled={submitting}
            onClick={() =>
              post(
                actionUrl,
                {
                  action: "ablehnen",
                  grund_kategorie: ablehnenKategorie,
                  interne_notiz: ablehnenNotiz || undefined,
                  ohne_mail: ablehnenOhneMail,
                },
                ablehnenOhneMail ? "Anfrage abgelehnt (ohne Mail)" : "Absage gesendet",
                true,
              )
            }
            className="w-full py-2 rounded bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            {ablehnenOhneMail ? "Ablehnen ohne Mail" : "Absage senden"}
          </button>
        </div>
      )}

      {submitting && <div className="text-xs text-gray-500 mt-2">Aktion läuft …</div>}
    </div>
  );
}
