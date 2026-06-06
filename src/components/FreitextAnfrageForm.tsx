"use client";

import { useState } from "react";
import { useCart } from "./CartContext";

/**
 * Freitext-Anfrage ohne Warenkorb.
 *
 * Schickt eine reine Text-Anfrage an POST /api/contact (ohne cart_items) —
 * Backend legt Kunde + Buchung (Status "Anfrage", ohne Preise) + Angebot an
 * und versendet die Eingangsbestätigung. Zeitraum ist API-Pflicht (max. 5 Tage).
 */
export default function FreitextAnfrageForm() {
  const { rangeVon, rangeBis } = useCart();

  const [open, setOpen] = useState(false);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [nachricht, setNachricht] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [website, setWebsite] = useState(""); // Honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"idle" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  function handleToggle() {
    if (!open) {
      // Zeitraum aus dem Site-weiten Datums-Picker übernehmen, falls gesetzt
      if (rangeVon && !von) setVon(rangeVon);
      if (rangeBis && !bis) setBis(rangeBis);
    }
    setOpen(!open);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (website.trim() !== "") {
      setSubmitResult("success");
      return;
    }
    const days = Math.round((new Date(bis).getTime() - new Date(von).getTime()) / 86_400_000);
    if (days > 5) {
      setErrorText("Der Mietzeitraum darf maximal 5 Tage betragen.");
      setSubmitResult("error");
      return;
    }

    setSubmitting(true);
    setSubmitResult("idle");
    setErrorText("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          email: email.trim(),
          telefon: telefon.trim() || undefined,
          event_datum_von: von,
          event_datum_bis: bis,
          nachricht: nachricht.trim(),
          agb_akzeptiert: agreed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorText(data.detail || data.error || `HTTP ${res.status}`);
        setSubmitResult("error");
      } else {
        setSubmitResult("success");
        setVorname("");
        setNachname("");
        setEmail("");
        setTelefon("");
        setNachricht("");
        setAgreed(false);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Netzwerk-Fehler");
      setSubmitResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all";

  return (
    <div className="glass-card p-6 md:p-8 mt-6">
      <h3 className="font-display text-xl font-semibold mb-2">
        Lieber frei anfragen?
      </h3>
      <p className="text-gray-400 text-sm">
        Sie wissen noch nicht genau, was Sie brauchen? Schreiben Sie uns einfach,
        was Sie planen — wir melden uns mit einem passenden Vorschlag.
      </p>

      {submitResult === "success" ? (
        <div className="mt-5 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
          Vielen Dank! Ihre Anfrage ist eingegangen — Sie erhalten in Kürze eine
          Eingangsbestätigung per E-Mail. Wir melden uns in der Regel innerhalb
          von 24 Stunden mit einem konkreten Angebot.
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={handleToggle}
          className="mt-5 block text-center w-full py-3 border border-gold-500/30 text-gold-400 font-medium rounded-lg hover:bg-gold-500/10 transition-all"
        >
          Freitext-Anfrage schreiben
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {submitResult === "error" && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              Es gab ein Problem beim Senden Ihrer Anfrage{errorText ? `: ${errorText}` : "."}{" "}
              Bitte versuchen Sie es in Kürze erneut.
            </div>
          )}

          {/* Honeypot */}
          <div className="hidden" aria-hidden="true">
            <label>
              Website (bitte freilassen)
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Vorname *</label>
              <input
                type="text"
                required
                autoComplete="given-name"
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nachname *</label>
              <input
                type="text"
                required
                autoComplete="family-name"
                value={nachname}
                onChange={(e) => setNachname(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">E-Mail *</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Handy <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                autoComplete="tel"
                placeholder="z.B. 0151 23456789"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Mietbeginn *</label>
              <input
                type="date"
                required
                min={today}
                value={von}
                onChange={(e) => setVon(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Rückgabe *</label>
              <input
                type="date"
                required
                min={von || today}
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Voraussichtlicher Zeitraum genügt — maximal 5 Tage.
          </p>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Ihre Nachricht *</label>
            <textarea
              rows={5}
              required
              minLength={3}
              value={nachricht}
              onChange={(e) => setNachricht(e.target.value)}
              placeholder="z.B. Wir feiern eine Hochzeit mit 40 Gästen im Garten und brauchen Zelte, Tische und Stühle …"
              className={`${inputClass} resize-none`}
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500/50"
              required
            />
            <span className="text-sm text-gray-400">
              Ich gebe hiermit meine Zustimmung zu den{" "}
              <a href="/agbs" className="text-gold-400 hover:text-gold-500 underline">
                AGB
              </a>{" "}
              und der{" "}
              <a href="/datenschutz" className="text-gold-400 hover:text-gold-500 underline">
                Datenschutzerklärung
              </a>
              .
            </span>
          </label>

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {submitting && (
                <svg
                  className="animate-spin h-5 w-5 text-navy-900"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <span>{submitting ? "Wird gesendet …" : "Unverbindlich anfragen"}</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              Unverbindlich. Keine Zahlung jetzt. Antwort in der Regel innerhalb 24 Stunden.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
