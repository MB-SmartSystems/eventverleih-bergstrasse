"use client";

import { useEffect, useState } from "react";

interface AvailabilityItem {
  artikel_id: number;
  artikel_name: string;
  available: boolean;
  restzahl: number;
  bestand_gesamt: number;
}

interface AvailabilityResponse {
  ok?: boolean;
  items?: AvailabilityItem[];
}

interface Props {
  rangeVon: string | null;
  rangeBis: string | null;
}

type State =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "ok"; total: number; available: number }
  | { kind: "error"; message: string };

export default function AvailabilityCounter({ rangeVon, rangeBis }: Props) {
  const [state, setState] = useState<State>({ kind: "empty" });

  useEffect(() => {
    if (!rangeVon || !rangeBis) {
      setState({ kind: "empty" });
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setState({ kind: "loading" });
      fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ von: rangeVon, bis: rangeBis }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return (await r.json()) as AvailabilityResponse;
        })
        .then((data) => {
          if (cancelled) return;
          const items = data.items ?? [];
          if (items.length === 0) {
            setState({ kind: "ok", total: 0, available: 0 });
            return;
          }
          const total = items.length;
          const available = items.filter((i) => i.available).length;
          setState({ kind: "ok", total, available });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : "Fehler";
          setState({ kind: "error", message: msg });
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [rangeVon, rangeBis]);

  if (state.kind === "empty") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
        <span>Waehlen Sie einen Zeitraum, um die Verfügbarkeit zu sehen</span>
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-sm">
        <svg
          className="animate-spin w-4 h-4 text-gold-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth={3}
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4l3-3-3-3v2C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Prüfe Verfügbarkeit…</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
        <span>Verfügbarkeit konnte nicht geladen werden.</span>
      </div>
    );
  }

  const { total, available } = state;
  const allOk = total > 0 && available === total;
  const someOut = total > 0 && available < total && available > total / 2;
  const muchOut = total > 0 && available <= total / 2;

  let tone = "bg-green-500/10 border-green-500/30 text-green-300";
  let icon = (
    <svg
      className="w-4 h-4 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  if (someOut) {
    tone = "bg-amber-500/10 border-amber-500/30 text-amber-300";
    icon = (
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
    );
  } else if (muchOut) {
    tone = "bg-red-500/10 border-red-500/30 text-red-300";
    icon = (
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    );
  }

  const text = allOk
    ? `Alle ${total} Artikel in Ihrem Zeitraum verfügbar`
    : `${available} von ${total} Artikeln verfügbar`;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${tone}`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
