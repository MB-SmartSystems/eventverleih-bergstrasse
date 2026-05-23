"use client";

import { useState } from "react";

type Kunde = {
  Vorname: string;
  Nachname: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};

interface DeclineFlags {
  lieferung: boolean;
  abholung: boolean;
  aufbau: boolean;
}

export default function AcceptForm({
  token,
  kunde,
  declineFlags,
}: {
  token: string;
  kunde: Kunde;
  declineFlags?: DeclineFlags;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Initial-Werte aus Baserow, vom Kunden ergänzbar
  const [telefon, setTelefon] = useState(kunde.Telefon || "");
  const [strasse, setStrasse] = useState(kunde.Adresse_Strasse || "");
  const [plz, setPlz] = useState(kunde.Adresse_PLZ || "");
  const [ort, setOrt] = useState(kunde.Adresse_Ort || "");
  const [agreed, setAgreed] = useState(false);

  const missing: string[] = [];
  if (!strasse.trim()) missing.push("Straße + Hausnummer");
  if (!plz.trim()) missing.push("PLZ");
  if (!ort.trim()) missing.push("Ort");
  if (!telefon.trim()) missing.push("Telefon");
  const allFieldsValid = missing.length === 0 && /^\d{4,5}$/.test(plz.trim());
  const canSubmit = allFieldsValid && agreed && !submitting && !done;

  async function handleClick(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/vertrag-akzeptieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          telefon: telefon.trim(),
          adresse_strasse: strasse.trim(),
          adresse_plz: plz.trim(),
          adresse_ort: ort.trim(),
          ...(declineFlags?.lieferung ? { decline_lieferung: true } : {}),
          ...(declineFlags?.abholung ? { decline_abholung: true } : {}),
          ...(declineFlags?.aufbau ? { decline_aufbau: true } : {}),
        }),
        redirect: "manual",
      });
      if (res.ok || res.status === 0 || res.type === "opaqueredirect") {
        setDone(true);
        setTimeout(() => window.location.reload(), 600);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleClick} className="mt-10 space-y-5">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          Es gab ein Problem beim Bestätigen: {error}. Bitte versuchen Sie es erneut oder melden Sie sich direkt bei Manuel.
        </div>
      )}

      <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <div>
          <h3 className="text-white font-semibold mb-1">Ihre Rechnungs-Anschrift</h3>
          <p className="text-xs text-gray-400">
            Wir brauchen Ihre vollständige Anschrift für die Vertragsbestätigung und spätere Rechnung. Pflichtfelder.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Straße + Hausnummer</label>
            <input
              type="text"
              required
              autoComplete="street-address"
              value={strasse}
              onChange={(e) => setStrasse(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">PLZ</label>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{4,5}"
              maxLength={5}
              autoComplete="postal-code"
              value={plz}
              onChange={(e) => setPlz(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ort</label>
            <input
              type="text"
              required
              autoComplete="address-level2"
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Telefon (für Rückfragen und Übergabe-Abstimmung)</label>
            <input
              type="tel"
              required
              autoComplete="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-white/10">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500/50"
            required
          />
          <span className="text-sm text-gray-400">
            Ich habe den{" "}
            <a href={`/vertrag/${token}`} target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-500 underline">
              Mietvertrag
            </a>{" "}
            und die{" "}
            <a href="/agbs" target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-500 underline">
              AGB
            </a>{" "}
            gelesen und akzeptiere sie. Die Verarbeitung meiner Daten erfolgt gemäß der{" "}
            <a href="/datenschutz" target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-500 underline">
              Datenschutzerklärung
            </a>
            .
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        disabled={!canSubmit}
      >
        {(submitting || done) && (
          <svg
            className="animate-spin h-5 w-5 text-navy-900"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        <span>
          {done
            ? "Bestätigt — Seite lädt neu …"
            : submitting
            ? "Wird bestätigt …"
            : "Angebot bestätigen"}
        </span>
      </button>

      {!agreed && allFieldsValid && (
        <p className="text-xs text-gray-500 text-center">Bitte AGB + Mietvertrag oben akzeptieren.</p>
      )}
      {missing.length > 0 && (
        <p className="text-xs text-gray-500 text-center">Bitte ergänzen Sie: {missing.join(", ")}.</p>
      )}

      <p className="text-xs text-gray-500 text-center">
        Bei Fragen direkt: WhatsApp/Telefon{" "}
        <a href="tel:+4915679521124" className="text-gold-400 hover:text-gold-500">
          +49 156 79521124
        </a>
      </p>
    </form>
  );
}
