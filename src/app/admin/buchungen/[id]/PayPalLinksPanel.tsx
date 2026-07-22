"use client";

import { useState } from "react";

interface Row {
  label: string;
  type: "anzahlung" | "restzahlung" | "komplettzahlung";
  amountEur: number;
  url: string;
  bezahlt: boolean;
}

export default function PayPalLinksPanel({ rows }: { rows: Row[] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      window.prompt("Link kopieren:", url);
    }
  }

  const visible = rows.filter((r) => r.amountEur > 0);
  if (visible.length === 0) return null;

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-warm-text">PayPal-Zahlungslinks</h2>
        <a
          href="https://www.paypal.com/businessprofile/mytools"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-warm-muted hover:text-accent"
        >
          PayPal ↗
        </a>
      </div>

      {visible.map((r) => (
        <div key={r.type} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-warm-text">
              {r.label} ({r.amountEur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
            </span>
            {r.bezahlt && <span className="text-xs text-green-600">✓ bezahlt</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={r.url}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 text-xs font-mono px-2 py-1.5 rounded border border-warm-border bg-warm-bg/40"
            />
            <button
              onClick={() => copy(r.url, r.type)}
              className="text-xs px-2 py-1.5 rounded bg-accent-50 text-accent-dark hover:bg-accent-100 transition-colors"
              title="Link in Zwischenablage kopieren"
            >
              {copiedKey === r.type ? "✓" : "Kopieren"}
            </button>
          </div>
        </div>
      ))}

      <p className="text-xs text-warm-muted leading-relaxed">
        Zahlung landet direkt auf dem PayPal-Konto. Der Link zeigt immer den aktuellen Soll-Betrag und
        läuft nicht ab. Kaution wird bei PayPal-Zahlung separat (bar/Überweisung) hinterlegt. Nach
        Zahlung wird der Status automatisch aktualisiert (PayPal-Webhook).
      </p>
    </section>
  );
}
