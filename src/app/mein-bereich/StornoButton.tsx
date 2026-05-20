"use client";

import { useState } from "react";

interface Props {
  buchungId: number;
  eventDatumVon: string | null;
  mietsumme: number;
  bezahlt: number;
}

function berechne(eventDatumVon: string | null, mietsumme: number, bezahlt: number) {
  if (!eventDatumVon) return null;
  const tage = Math.floor((new Date(eventDatumVon).getTime() - Date.now()) / 86_400_000);
  let prozent = 0;
  let label = "";
  if (tage > 14) { prozent = 0; label = "Mehr als 14 Tage vor Event"; }
  else if (tage >= 7) { prozent = 50; label = "7-14 Tage vor Event"; }
  else if (tage >= 4) { prozent = 75; label = "4-7 Tage vor Event"; }
  else { prozent = 100; label = "Weniger als 4 Tage vor Event"; }
  const gebuehr = Math.round(mietsumme * prozent / 100 * 100) / 100;
  const erstattung = Math.round((bezahlt - gebuehr) * 100) / 100;
  const nachzahlung = erstattung < 0 ? -erstattung : 0;
  return { tage, prozent, label, gebuehr, erstattung, nachzahlung };
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export default function StornoButton({ buchungId, eventDatumVon, mietsumme, bezahlt }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const calc = berechne(eventDatumVon, mietsumme, bezahlt);

  async function confirm() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/member/buchung/${buchungId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `HTTP ${res.status}`);
        setSubmitting(false);
      } else {
        // Reload Dashboard
        window.location.href = "/mein-bereich";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-red-300 underline"
      >
        Buchung stornieren
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !submitting && setOpen(false)}>
          <div className="bg-navy-800 border border-white/10 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-white mb-4">Buchung stornieren?</h2>
            {!calc ? (
              <p className="text-gray-400">Kein Event-Datum gesetzt — Stornierung ueber Manuel abwickeln.</p>
            ) : (
              <>
                <div className="space-y-3 text-sm">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Zeitlage</div>
                    <div className="text-white">{calc.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{calc.tage} Tage bis Event</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-xs text-gray-400">Stornogebuehr ({calc.prozent}%)</div>
                      <div className="text-lg font-semibold text-amber-300">{fmtEur(calc.gebuehr)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="text-xs text-gray-400">Bereits bezahlt</div>
                      <div className="text-lg font-semibold text-white">{fmtEur(bezahlt)}</div>
                    </div>
                  </div>
                  {calc.erstattung > 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="text-xs text-green-300 uppercase tracking-wider">Sie erhalten zurueck</div>
                      <div className="text-2xl font-bold text-green-200">{fmtEur(calc.erstattung)}</div>
                      <div className="text-xs text-gray-400 mt-1">Erstattung erfolgt in 5 Werktagen</div>
                    </div>
                  )}
                  {calc.erstattung === 0 && calc.gebuehr === 0 && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="text-sm text-green-200">Kostenfreie Stornierung — keine Gebuehr.</div>
                    </div>
                  )}
                  {calc.nachzahlung > 0 && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="text-xs text-red-300 uppercase tracking-wider">Sie muessen nachzahlen</div>
                      <div className="text-2xl font-bold text-red-200">{fmtEur(calc.nachzahlung)}</div>
                      <div className="text-xs text-gray-400 mt-1">Sie erhalten eine Stornorechnung per Mail</div>
                    </div>
                  )}
                </div>
                {error && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                    {error}
                  </div>
                )}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg border border-white/15 text-gray-300 text-sm hover:bg-white/5 transition-all"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={confirm}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
                  >
                    {submitting ? "Wird storniert…" : "Verbindlich stornieren"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
