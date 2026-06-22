"use client";

import { useState } from "react";

export type PositionItem = {
  id: number;
  artikelId: number;
  bezeichnung: string;
  anzahl: number;
  einzelpreis: number;
};

export type ArtikelOption = {
  id: number;
  bezeichnung: string;
  preis: number;
  kategorie: string;
};

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export type FreiInfo = Record<number, { frei: number; bestand: number; bestellbar: boolean }>;

export default function PositionsEditor({
  buchungId,
  initialPositionen,
  artikelOptions,
  freiInfo,
}: {
  buchungId: number;
  initialPositionen: PositionItem[];
  artikelOptions: ArtikelOption[];
  freiInfo?: FreiInfo;
}) {
  const [positionen, setPositionen] = useState<PositionItem[]>(initialPositionen);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [addArtikelId, setAddArtikelId] = useState<number>(artikelOptions[0]?.id ?? 0);
  const [addAnzahl, setAddAnzahl] = useState<number>(1);

  const summe = positionen.reduce((s, p) => s + p.anzahl * p.einzelpreis, 0);

  // Live-Verfuegbarkeits-Badge: vergleicht die aktuell getippte Anzahl gegen das (stabile)
  // freie Kontingent fuer den Buchungs-Zeitraum. frei = Bestand minus durch ANDERE committete
  // Buchungen gebundene Menge. Warnt rot bei Ueberbuchung, amber beim letzten Stueck.
  function availBadge(artikelId: number, anzahl: number) {
    const info = freiInfo?.[artikelId];
    if (!info) return null; // kein Datum gesetzt o.ae. → nichts anzeigen
    const { frei, bestand, bestellbar } = info;
    if (bestellbar && frei <= 0) {
      return (
        <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
          auf Bestellung · {bestand} im eigenen Bestand
        </span>
      );
    }
    if (anzahl > frei) {
      return (
        <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/40">
          ⚠ Überbuchung: nur {frei} von {bestand} frei für diesen Zeitraum
        </span>
      );
    }
    if (frei > 0 && anzahl === frei) {
      return (
        <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/40">
          ⚠ letztes Stück — {frei} von {bestand} frei
        </span>
      );
    }
    return (
      <span className="inline-block mt-1 text-[11px] text-gray-500">
        {frei} von {bestand} frei
      </span>
    );
  }

  function setPos(id: number, patch: Partial<PositionItem>) {
    setPositionen((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function saveOne(id: number) {
    const p = positionen.find((x) => x.id === id);
    if (!p) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/position/${id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anzahl: p.anzahl, einzelpreis: p.einzelpreis, buchungId }),
      });
      const d = await res.json();
      if (!res.ok) setError([d.error, d.detail].filter(Boolean).join(" — "));
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusyId(null);
    }
  }

  async function delOne(id: number) {
    if (!confirm("Position wirklich entfernen?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/position/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buchungId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError([d.error, d.detail].filter(Boolean).join(" — "));
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusyId(null);
    }
  }

  async function addNew() {
    if (!addArtikelId || addAnzahl < 1) return;
    const art = artikelOptions.find((a) => a.id === addArtikelId);
    if (!art) return;
    setBusyId("new");
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/position/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artikelId: addArtikelId, anzahl: addAnzahl, einzelpreis: art.preis }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError([d.error, d.detail].filter(Boolean).join(" — "));
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          Positionen ({positionen.length}) — Mietsumme: <span className="font-mono">{fmtEur(summe)}</span>
        </h2>
      </div>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
      )}

      {positionen.length === 0 ? (
        <p className="text-sm text-gray-400">Noch keine Positionen — unten hinzufügen.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-white/10">
              <th className="py-2 pr-2">Artikel</th>
              <th className="text-right w-20">Anzahl</th>
              <th className="text-right w-28">Einzelpreis</th>
              <th className="text-right w-24">Gesamt</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {positionen.map((p) => {
              const ges = p.anzahl * p.einzelpreis;
              return (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2 pr-2 text-gray-200">
                    <div>{p.bezeichnung}</div>
                    {availBadge(p.artikelId, p.anzahl)}
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={p.anzahl}
                      onChange={(e) => setPos(p.id, { anzahl: parseInt(e.target.value, 10) || 0 })}
                      disabled={busyId === p.id}
                      className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-right text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/50"
                    />
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.einzelpreis}
                      onChange={(e) => setPos(p.id, { einzelpreis: parseFloat(e.target.value) || 0 })}
                      disabled={busyId === p.id}
                      className="w-24 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-right text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/50"
                    />
                  </td>
                  <td className="text-right font-mono text-white pl-2">{fmtEur(ges)}</td>
                  <td className="text-right pl-2">
                    <button
                      onClick={() => saveOne(p.id)}
                      disabled={busyId === p.id}
                      className="px-2 py-1 rounded bg-gold-500/20 hover:bg-gold-500/30 text-gold-200 text-xs disabled:opacity-40 mr-1"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => delOne(p.id)}
                      disabled={busyId === p.id}
                      className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Position hinzufügen */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Position hinzufügen</div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <select
              value={addArtikelId}
              onChange={(e) => setAddArtikelId(parseInt(e.target.value, 10))}
              disabled={busyId === "new"}
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/50"
            >
              {artikelOptions.map((a) => (
                <option key={a.id} value={a.id} className="bg-gray-900">
                  {a.kategorie} · {a.bezeichnung} — {fmtEur(a.preis)}
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            min={1}
            value={addAnzahl}
            onChange={(e) => setAddAnzahl(parseInt(e.target.value, 10) || 1)}
            disabled={busyId === "new"}
            className="w-20 px-2 py-2 rounded bg-white/5 border border-white/10 text-white text-right text-sm focus:outline-none focus:ring-1 focus:ring-gold-500/50"
          />
          <button
            onClick={addNew}
            disabled={busyId === "new"}
            className="px-4 py-2 rounded bg-gold-500/30 hover:bg-gold-500/40 text-gold-100 text-sm font-medium disabled:opacity-40"
          >
            {busyId === "new" ? "…" : "+ Hinzufügen"}
          </button>
        </div>
        {/* Live-Verfügbarkeit für den aktuell gewählten Artikel + Anzahl */}
        <div className="mt-2">{availBadge(addArtikelId, addAnzahl)}</div>
      </div>
    </section>
  );
}
