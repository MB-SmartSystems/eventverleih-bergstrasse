"use client";

/**
 * Buchungs-Checkliste — UI-Helfer fuer Manuel.
 *
 * Items nach PHASE gruppiert (Angebot · Zahlung · Übergabe · Rückgabe · Abrechnung).
 * Die Pack-Liste sitzt im Übergabe-Block (direkt bei Übergabe-Termin + Übergabe durchgeführt).
 *
 * Auto-Items sind read-only (aus Buchungs-Daten abgeleitet), manuelle + Pack-Items togglebar.
 * Persistenz UNVERÄNDERT: Buchung.Checklist_State_JSON (manuell) bzw. Position.Eingepackt (Pack).
 * KEINE Mail-Versand-Gate-Funktion — pur visueller Helfer.
 */
import { useState } from "react";

interface AutoItem {
  key: string;
  label: string;
  checked: boolean;
  meta?: string;
  phase: string;
}

interface ManualItem {
  key: string;
  label: string;
  checked: boolean;
  phase: string;
}

interface PackItem {
  positionId: number;
  label: string; // z.B. "12× Stuhl"
  checked: boolean;
}

const PHASE_ORDER = ["Angebot", "Zahlung", "Übergabe", "Rückgabe", "Abrechnung"];

export default function BuchungChecklist({
  buchungId,
  autoItems,
  manualItems,
  packItems,
  packPhase = "Übergabe",
}: {
  buchungId: number;
  autoItems: AutoItem[];
  manualItems: ManualItem[];
  packItems: PackItem[];
  packPhase?: string;
}) {
  const [items, setItems] = useState({
    manual: Object.fromEntries(manualItems.map((m) => [m.key, m.checked])),
    pack: Object.fromEntries(packItems.map((p) => [String(p.positionId), p.checked])),
  });
  const [packOpen, setPackOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(itemKey: string, itemType: "manual" | "pack", current: boolean) {
    setPending(itemKey);
    setError("");
    const newChecked = !current;
    setItems((prev) => ({
      ...prev,
      [itemType]: { ...prev[itemType], [itemKey]: newChecked },
    }));
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: itemKey, checked: newChecked, item_type: itemType }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `HTTP ${res.status}`);
        setItems((prev) => ({ ...prev, [itemType]: { ...prev[itemType], [itemKey]: current } }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setItems((prev) => ({ ...prev, [itemType]: { ...prev[itemType], [itemKey]: current } }));
    } finally {
      setPending(null);
    }
  }

  const packDoneCount = Object.values(items.pack).filter(Boolean).length;
  const packTotal = packItems.length;

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <h2 className="text-lg font-semibold text-warm-text mb-3">Checkliste</h2>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      <div className="space-y-4 text-sm">
        {PHASE_ORDER.map((phase) => {
          const autos = autoItems.filter((a) => a.phase === phase);
          const manuals = manualItems.filter((m) => m.phase === phase);
          const showPack = phase === packPhase && packItems.length > 0;
          if (autos.length === 0 && manuals.length === 0 && !showPack) return null;
          return (
            <div key={phase}>
              <p className="text-[10px] uppercase tracking-wider text-warm-muted/70 mb-1.5">{phase}</p>
              <div className="space-y-1.5">
                {autos.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2 ${item.checked ? "text-warm-text" : "text-warm-muted"}`}
                  >
                    <span className={`inline-block w-4 ${item.checked ? "text-green-600" : "text-gray-300"}`}>
                      {item.checked ? "✓" : "○"}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.meta && <span className="text-xs text-warm-muted">{item.meta}</span>}
                    <span className="text-[10px] uppercase tracking-wider text-warm-muted/60">auto</span>
                  </div>
                ))}
                {manuals.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => toggle(m.key, "manual", items.manual[m.key])}
                    disabled={pending === m.key}
                    className={`w-full flex items-center gap-2 text-left transition-colors disabled:opacity-50 ${
                      items.manual[m.key] ? "text-warm-text" : "text-warm-muted hover:text-warm-text"
                    }`}
                  >
                    <span className={`inline-block w-4 ${items.manual[m.key] ? "text-green-600" : "text-gray-400"}`}>
                      {items.manual[m.key] ? "✓" : "○"}
                    </span>
                    <span className="flex-1">{m.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-warm-muted/60">manuell</span>
                  </button>
                ))}
                {showPack && (
                  <div>
                    <button
                      onClick={() => setPackOpen(!packOpen)}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      <span className={`inline-block w-4 ${packDoneCount === packTotal ? "text-green-600" : "text-gray-400"}`}>
                        {packDoneCount === packTotal ? "✓" : "○"}
                      </span>
                      <span className="flex-1 font-medium">
                        Pack-Liste durchgegangen
                        <span className="text-xs text-warm-muted ml-2">
                          {packDoneCount}/{packTotal}
                        </span>
                      </span>
                      <span className="text-xs text-warm-muted">{packOpen ? "▴" : "▾"}</span>
                    </button>
                    {packOpen && (
                      <div className="pl-6 mt-2 space-y-1">
                        {packItems.map((p) => (
                          <button
                            key={p.positionId}
                            onClick={() => toggle(String(p.positionId), "pack", items.pack[String(p.positionId)])}
                            disabled={pending === String(p.positionId)}
                            className={`w-full flex items-center gap-2 text-left text-sm disabled:opacity-50 ${
                              items.pack[String(p.positionId)] ? "text-warm-text" : "text-warm-muted hover:text-warm-text"
                            }`}
                          >
                            <span className={`inline-block w-4 ${items.pack[String(p.positionId)] ? "text-green-600" : "text-gray-400"}`}>
                              {items.pack[String(p.positionId)] ? "✓" : "○"}
                            </span>
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
