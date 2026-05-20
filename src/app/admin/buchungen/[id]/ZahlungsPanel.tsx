"use client";

import { useState } from "react";

type Typ = "anzahlung" | "restzahlung" | "kaution";
type Methode = "Bar" | "Ueberweisung" | "Stripe";

const LABELS: Record<Typ, string> = {
  anzahlung: "Anzahlung",
  restzahlung: "Restzahlung",
  kaution: "Kaution hinterlegt",
};

interface ZahlungsEintrag {
  datum: string;
  typ: Typ;
  betrag: number;
  methode: string;
  erfasst_am: string;
}

export default function ZahlungsPanel({
  buchungId,
  anzahlungBezahlt,
  restzahlungBezahlt,
  kautionHinterlegt,
  anzahlungSollEur,
  restzahlungSollEur,
  kautionSollEur,
  zahlungen,
}: {
  buchungId: number;
  anzahlungBezahlt: string | null;
  restzahlungBezahlt: string | null;
  kautionHinterlegt: string | null;
  anzahlungSollEur: number;
  restzahlungSollEur: number;
  kautionSollEur: number;
  zahlungen?: ZahlungsEintrag[];
}) {
  const [submitting, setSubmitting] = useState<Typ | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState<Record<Typ, string>>({
    anzahlung: today,
    restzahlung: today,
    kaution: today,
  });
  const [betrag, setBetrag] = useState<Record<Typ, string>>({
    anzahlung: anzahlungSollEur > 0 ? anzahlungSollEur.toFixed(2) : "",
    restzahlung: restzahlungSollEur > 0 ? restzahlungSollEur.toFixed(2) : "",
    kaution: kautionSollEur > 0 ? kautionSollEur.toFixed(2) : "",
  });
  const [methode, setMethode] = useState<Record<Typ, Methode>>({
    anzahlung: "Bar",
    restzahlung: "Bar",
    kaution: "Bar",
  });

  async function setze(typ: Typ) {
    const betragNum = parseFloat(betrag[typ]);
    if (isNaN(betragNum) || betragNum <= 0) {
      setError("Betrag muss eine positive Zahl sein.");
      return;
    }
    setSubmitting(typ);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/zahlung`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typ,
          datum: datum[typ],
          betrag_eur: betragNum,
          methode: methode[typ],
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, d.detail].filter(Boolean).join(" — "));
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(null);
    }
  }

  function summeFuer(typ: Typ): number {
    return (zahlungen || [])
      .filter((z) => z.typ === typ)
      .reduce((s, z) => s + z.betrag, 0);
  }

  function row(typ: Typ, current: string | null, soll: number) {
    const fmt = current ? new Date(current).toLocaleDateString("de-DE") : null;
    const summe = summeFuer(typ);
    const offen = Math.max(0, soll - summe);
    return (
      <div className="space-y-2 p-3 rounded-lg bg-warm-bg/40 border border-warm-border">
        <div className="flex items-baseline gap-2">
          <div className="flex-1">
            <div className="text-sm font-medium text-warm-text">{LABELS[typ]}</div>
            <div className="text-xs text-warm-muted">
              Soll: {soll.toFixed(2)} €
              {summe > 0 && (
                <>
                  {" "}· Bezahlt: <span className="text-green-700 font-medium">{summe.toFixed(2)} €</span>
                  {offen > 0 && <> · Offen: <span className="text-amber-700">{offen.toFixed(2)} €</span></>}
                  {offen === 0 && summe >= soll && <span className="text-green-700"> ✓ vollstaendig</span>}
                </>
              )}
            </div>
            {fmt && summe === 0 && <div className="text-xs text-green-700">✓ erhalten am {fmt}</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={betrag[typ]}
            onChange={(e) => setBetrag({ ...betrag, [typ]: e.target.value })}
            placeholder="Betrag €"
            disabled={submitting !== null}
            className="w-24 px-2 py-1 rounded border border-warm-border bg-warm-bg text-warm-text text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <select
            value={methode[typ]}
            onChange={(e) => setMethode({ ...methode, [typ]: e.target.value as Methode })}
            disabled={submitting !== null}
            className="px-2 py-1 rounded border border-warm-border bg-warm-bg text-warm-text text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            <option value="Bar">Bar</option>
            <option value="Ueberweisung">Überweisung</option>
            <option value="Stripe">Stripe</option>
          </select>
          <input
            type="date"
            value={datum[typ]}
            onChange={(e) => setDatum({ ...datum, [typ]: e.target.value })}
            disabled={submitting !== null}
            className="px-2 py-1 rounded border border-warm-border bg-warm-bg text-warm-text text-xs focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <button
            onClick={() => setze(typ)}
            disabled={submitting !== null}
            className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:bg-accent-dark disabled:opacity-40"
          >
            {submitting === typ ? "…" : "Erfassen"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
      <h2 className="text-lg font-semibold text-warm-text">Zahlungseingang erfassen</h2>
      <p className="text-xs text-warm-muted">
        Trag Bar- oder Ueberweisungs-Eingaenge ein. Stripe-Eingaenge werden automatisch via
        Webhook erfasst — du musst nichts manuell setzen.
      </p>
      {error && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      {row("anzahlung", anzahlungBezahlt, anzahlungSollEur)}
      {row("restzahlung", restzahlungBezahlt, restzahlungSollEur)}
      {row("kaution", kautionHinterlegt, kautionSollEur)}
      <p className="text-xs text-warm-muted pt-2 border-t border-warm-border">
        Anzahlung &gt;= Soll setzt Status automatisch auf <strong>Reserviert</strong> (Hart-Block).
      </p>
    </section>
  );
}
