"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StripeLinksPanelProps {
  buchungId: number;
  anzahlungSollEur: number;
  restzahlungSollEur: number;
  anzahlungLink: string | null;
  restzahlungLink: string | null;
  anzahlungBezahlt: boolean;
  restzahlungBezahlt: boolean;
}

export default function StripeLinksPanel({
  buchungId,
  anzahlungSollEur,
  restzahlungSollEur,
  anzahlungLink,
  restzahlungLink,
  anzahlungBezahlt,
  restzahlungBezahlt,
}: StripeLinksPanelProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState<"anzahlung" | "restzahlung" | null>(null);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function generateLink(type: "anzahlung" | "restzahlung") {
    setGenerating(type);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Fehler beim Generieren");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setGenerating(null);
    }
  }

  async function copyLink(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
      window.prompt("Link kopieren:", url);
    }
  }

  function renderRow(
    label: string,
    type: "anzahlung" | "restzahlung",
    sollEur: number,
    link: string | null,
    bezahlt: boolean,
  ) {
    if (sollEur <= 0) return null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-warm-text">{label} ({sollEur} €)</span>
          {bezahlt && <span className="text-xs text-green-600">✓ bezahlt</span>}
        </div>
        {link ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={link}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 text-xs font-mono px-2 py-1.5 rounded border border-warm-border bg-warm-bg/40"
            />
            <button
              onClick={() => copyLink(link, type)}
              className="text-xs px-2 py-1.5 rounded bg-accent-50 text-accent-dark hover:bg-accent-100 transition-colors"
              title="Link in Zwischenablage kopieren"
            >
              {copiedKey === type ? "✓" : "📋"}
            </button>
            <button
              onClick={() => generateLink(type)}
              disabled={generating !== null || bezahlt}
              className="text-xs px-2 py-1.5 rounded text-warm-muted hover:text-warm-text disabled:opacity-30"
              title="Neuen Link generieren (alter wird ersetzt)"
            >
              ↻
            </button>
          </div>
        ) : (
          <button
            onClick={() => generateLink(type)}
            disabled={generating !== null || bezahlt}
            className="w-full text-sm px-3 py-2 rounded-lg border border-dashed border-accent text-accent-dark hover:bg-accent-50 disabled:opacity-50 transition-colors"
          >
            {generating === type ? "Generiere..." : `Stripe-Link für ${label} generieren`}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-text">Stripe-Zahlungslinks</h2>
        <a
          href="https://dashboard.stripe.com/payments"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-warm-muted hover:text-accent"
        >
          Stripe Dashboard ↗
        </a>
      </div>

      {renderRow("Anzahlung", "anzahlung", anzahlungSollEur, anzahlungLink, anzahlungBezahlt)}
      {renderRow("Restzahlung", "restzahlung", restzahlungSollEur, restzahlungLink, restzahlungBezahlt)}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      <p className="text-xs text-warm-muted leading-relaxed">
        Link in die nächste Bestätigungs-Mail einfügen. Nach Zahlung wird der Status automatisch
        aktualisiert (Stripe-Webhook → Buchungs-Status).
      </p>
    </section>
  );
}
