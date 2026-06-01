"use client";

import { useState } from "react";
import Link from "next/link";
import type { PendingMailItem } from "@/lib/eventverleih/inbox";

function templateLabel(key: string): string {
  if (key === "anzahlung_post3") return "Anzahlung · 3 Tage nach Akzept";
  if (key === "anzahlung_pre14") return "Anzahlung · 14 Tage vor Event";
  if (key === "anzahlung_pre7") return "Anzahlung · 7 Tage vor Event";
  if (key === "anzahlung_pre3") return "Anzahlung · 3 Tage vor Event";
  if (key === "restzahlung_pre14") return "Restzahlung · 14 Tage vor Event";
  if (key === "restzahlung_pre7") return "Restzahlung · 7 Tage vor Event";
  if (key === "restzahlung_pre3") return "Restzahlung · 3 Tage vor Event";
  if (key === "kaution_hold_link") return "Kaution-Hold-Link";
  return key || "Mail";
}

function daysSinceLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "heute erstellt";
  if (days === 1) return "seit 1 Tag wartend";
  return `seit ${days} Tagen wartend`;
}

export function PendingMailRow({ mail }: { mail: PendingMailItem }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(kind: "approve" | "reject") {
    setLoading(kind);
    setError(null);
    try {
      const r = await fetch(`/api/admin/mailqueue/${mail.id}/${kind}`, { method: "POST" });
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        throw new Error(detail.detail || detail.error || `HTTP ${r.status}`);
      }
      setDone(kind === "approve" ? "approved" : "rejected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setLoading(null);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        {done === "approved" ? "✓ Freigegeben — n8n versendet beim nächsten Poll" : "✓ Verworfen — Mail wird nicht versendet"}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block rounded bg-yellow-100 text-yellow-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              {templateLabel(mail.template_key)}
            </span>
            <span className="text-xs text-gray-500">{daysSinceLabel(mail.erstellt_am)}</span>
          </div>
          <div className="text-sm font-medium text-gray-900 mt-1 truncate">
            {mail.subject}
          </div>
          {(mail.kunde_name || mail.buchung_id) && (
            <div className="text-xs text-gray-600">
              {mail.kunde_name && <span>{mail.kunde_name}</span>}
              {mail.buchung_id && (
                <>
                  {mail.kunde_name && <span> · </span>}
                  <Link
                    href={`/admin/buchungen/${mail.buchung_id}`}
                    className="underline hover:text-gray-900"
                  >
                    Buchung #{mail.buchung_id}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => action("approve")}
            disabled={loading !== null}
            className="px-2.5 py-1 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "approve" ? "…" : "Freigeben"}
          </button>
          <button
            onClick={() => action("reject")}
            disabled={loading !== null}
            className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "reject" ? "…" : "Verwerfen"}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Body einklappen" : "Body anschauen"}
            className="px-2 py-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-xs"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
          Fehler: {error}
        </div>
      )}
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 max-h-72 overflow-auto font-sans">
          {mail.body}
        </pre>
      )}
    </div>
  );
}
