"use client";

import { useState } from "react";

export default function PayPalPayButton({
  buchungId,
  type,
  sig,
}: {
  buchungId: number;
  type: string;
  sig: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buchungId, type, sig }),
      });
      const data = await res.json();
      if (!res.ok || !data.approveUrl) {
        if (data.error === "bereits_bezahlt") {
          setError("Diese Zahlung ist bereits eingegangen — es ist nichts weiter zu tun.");
        } else {
          setError(data.detail || data.error || "Die Zahlung konnte nicht gestartet werden. Bitte später erneut versuchen.");
        }
        setLoading(false);
        return;
      }
      // Weiter zu PayPal
      window.location.href = data.approveUrl;
    } catch {
      setError("Verbindungsfehler. Bitte später erneut versuchen.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={start}
        disabled={loading}
        className="w-full rounded-full bg-[#0070ba] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#005ea6] disabled:opacity-60"
      >
        {loading ? "Weiterleitung zu PayPal…" : "Mit PayPal bezahlen"}
      </button>
      <p className="text-center text-xs text-warm-muted">
        Sie werden zu PayPal weitergeleitet. Zahlung auch mit Kredit- oder Debitkarte möglich —
        ein PayPal-Konto ist nicht erforderlich.
      </p>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
