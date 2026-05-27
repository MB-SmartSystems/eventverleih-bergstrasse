"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  buchungId: number;
  kautionSollEur: number;
  kautionLink: string | null;
  kautionHinterlegtAm: string | null;
}

export default function KautionMailPanel({
  buchungId,
  kautionSollEur,
  kautionLink,
  kautionHinterlegtAm,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  if (kautionSollEur <= 0) return null;

  const hinterlegt = Boolean(kautionHinterlegtAm);

  async function sendMail() {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/kaution-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      setFeedback(
        data.reused
          ? "Bestehender Hold-Link wurde dem Kunden nochmal gemailt."
          : "Neuer Hold-Link erstellt und an Kunden gemailt.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!kautionLink) return;
    try {
      await navigator.clipboard.writeText(kautionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Hold-Link kopieren:", kautionLink);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-text">Kaution-Hold ({kautionSollEur} €)</h2>
        {hinterlegt && <span className="text-xs text-green-600 font-medium">✓ Hold platziert</span>}
      </div>

      {hinterlegt ? (
        <p className="text-sm text-warm-muted">
          Hold platziert am {new Date(kautionHinterlegtAm!).toLocaleDateString("de-DE")}. Auflösung bei Rücknahme über
          den Rücknahme-Dialog (Capture bei Schaden / Cancel ohne Schaden).
        </p>
      ) : (
        <>
          <p className="text-sm text-warm-muted leading-relaxed">
            Kunde bekommt einen Stripe-Link, hinterlegt die Karte für die Kaution. Stripe blockiert den Betrag (Pre-Auth),
            bucht aber nichts ab. Auflösung bei Rückgabe.
          </p>

          {kautionLink && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={kautionLink}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 text-xs font-mono px-2 py-1.5 rounded border border-warm-border bg-warm-bg/40"
              />
              <button
                onClick={copyLink}
                className="text-xs px-2 py-1.5 rounded bg-accent-50 text-accent-dark hover:bg-accent-100 transition-colors"
                title="Link in Zwischenablage kopieren"
              >
                {copied ? "✓" : "Kopieren"}
              </button>
            </div>
          )}

          <button
            onClick={sendMail}
            disabled={busy}
            className="w-full text-sm px-3 py-2 rounded-lg border border-dashed border-accent text-accent-dark hover:bg-accent-50 disabled:opacity-50 transition-colors"
          >
            {busy
              ? "Sende..."
              : kautionLink
                ? "Hold-Link erneut an Kunden mailen"
                : "Kaution-Hold-Link an Kunden mailen"}
          </button>

          {feedback && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{feedback}</p>}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

          <p className="text-xs text-warm-muted leading-relaxed">
            Empfehlung: 5-7 Tage vor Übergabe senden. Hold ist standardmäßig 7 Tage gültig (Visa/MC bis 30 Tage). Bei
            Karte ohne Pre-Auth-Support kann Kunde antworten → Kaution in bar bei Übergabe.
          </p>
        </>
      )}
    </section>
  );
}
