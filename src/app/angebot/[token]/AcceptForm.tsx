"use client";

import { useState } from "react";

export default function AcceptForm({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (submitting || done) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/vertrag-akzeptieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        redirect: "manual",
      });
      // 303 Redirect oder 200 = beide gelten als Erfolg
      if (res.ok || res.status === 0 || res.type === "opaqueredirect") {
        setDone(true);
        // Page reloaden damit Server-Side den "Akzeptiert"-Banner rendert
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
    <div className="mt-10 flex flex-col gap-4">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          Es gab ein Problem beim Bestätigen: {error}. Bitte versuche es erneut oder melde dich direkt bei Manuel.
        </div>
      )}
      <button
        onClick={handleClick}
        type="button"
        className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        disabled={submitting || done}
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
            : "Angebot bestätigen + Reservierung sichern"}
        </span>
      </button>
      <p className="text-xs text-gray-500 text-center">
        Bei Fragen direkt: WhatsApp/Telefon{" "}
        <a href="tel:+4915679521124" className="text-gold-400 hover:text-gold-500">
          +49 156 79521124
        </a>
      </p>
    </div>
  );
}
