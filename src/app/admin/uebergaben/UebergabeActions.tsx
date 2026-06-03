"use client";

/**
 * Self-contained Übergabe-Workflow für unterwegs (mobil):
 *   1. Fette Pack-Checkliste zum Abhaken (persistiert via /checklist, item_type=pack)
 *   2. Zahlung als BAR bestätigen — smart je Stand:
 *        nichts bezahlt → "Komplett bar" (Gesamt) + "nur Anzahlung bar"
 *        Anzahlung da   → "Restzahlung bar"
 *      (ruft die GETESTETE /zahlung-Route, Betrag = Soll)
 *   3. Kaution bar bestätigen
 *   4. Übergabe bestätigen (Status → Übergeben)
 * Alles schreibt in die Buchung. Für Sonderbeträge → "Details"-Link (volle Panels).
 */
import { useState } from "react";

interface Pack {
  positionId: number;
  label: string;
  checked: boolean;
}

function eur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export default function UebergabeActions({
  buchungId,
  packItems,
  anzahlungOffen,
  anzahlungSoll,
  restzahlungOffen,
  restzahlungSoll,
  kautionOffen,
  kautionSoll,
}: {
  buchungId: number;
  packItems: Pack[];
  anzahlungOffen: boolean;
  anzahlungSoll: number;
  restzahlungOffen: boolean;
  restzahlungSoll: number;
  kautionOffen: boolean;
  kautionSoll: number;
}) {
  const [pack, setPack] = useState<Record<string, boolean>>(
    Object.fromEntries(packItems.map((p) => [String(p.positionId), p.checked])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  async function togglePack(positionId: number) {
    const key = String(positionId);
    const next = !pack[key];
    setPack((p) => ({ ...p, [key]: next }));
    setBusy("pack-" + key);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: key, checked: next, item_type: "pack" }),
      });
      if (!res.ok) {
        setPack((p) => ({ ...p, [key]: !next }));
        const d = await res.json().catch(() => ({}));
        setError(d.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setPack((p) => ({ ...p, [key]: !next }));
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(null);
    }
  }

  async function postZahlung(typen: Array<"anzahlung" | "restzahlung" | "kaution">, label: string, key: string) {
    if (busy) return;
    if (!confirm(`${label} als BAR erhalten bestätigen?`)) return;
    setBusy(key);
    setError("");
    try {
      let ok = true;
      let detail = "";
      for (const typ of typen) {
        const res = await fetch(`/api/admin/buchung/${buchungId}/zahlung`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typ, datum: today, methode: "Bar" }), // Betrag weggelassen → Soll
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          detail = [d.error, d.detail].filter(Boolean).join(" — ");
          ok = false;
          break;
        }
      }
      if (ok) window.location.reload();
      else {
        setError(detail || "Fehler bei der Zahlungserfassung");
        setBusy(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setBusy(null);
    }
  }

  async function uebergabeBestaetigen() {
    if (busy) return;
    const offen = packItems.length - Object.values(pack).filter(Boolean).length;
    const warn = offen > 0 ? `Achtung: ${offen} Pack-Position(en) noch nicht abgehakt. ` : "";
    if (!confirm(`${warn}Übergabe jetzt bestätigen (Status → Übergeben)?`)) return;
    setBusy("uebergabe");
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Uebergeben" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError([d.error, d.detail].filter(Boolean).join(" — "));
        setBusy(null);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setBusy(null);
    }
  }

  const packDone = Object.values(pack).filter(Boolean).length;
  const gesamtOffen = (anzahlungOffen ? anzahlungSoll : 0) + (restzahlungOffen ? restzahlungSoll : 0);

  return (
    <div className="mt-3 space-y-3">
      {error && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {/* Pack-Checkliste */}
      <div>
        <div className="text-xs font-medium text-warm-muted uppercase tracking-wide mb-1">
          Packliste {packItems.length > 0 && `(${packDone}/${packItems.length})`}
        </div>
        {packItems.length === 0 ? (
          <p className="text-sm text-warm-muted">Keine Artikel hinterlegt.</p>
        ) : (
          <div className="space-y-1">
            {packItems.map((p) => {
              const key = String(p.positionId);
              const checked = pack[key];
              return (
                <button
                  key={p.positionId}
                  onClick={() => togglePack(p.positionId)}
                  disabled={busy === "pack-" + key}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                    checked
                      ? "bg-warm-bg border-warm-border text-warm-text"
                      : "bg-warm-bg border-warm-border text-warm-text hover:bg-accent-50"
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md border-2 shrink-0 ${checked ? "bg-green-500 border-green-500 text-white" : "border-warm-border"}`}>
                    {checked ? "✓" : ""}
                  </span>
                  <span className="text-base font-medium">{p.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Zahlung bar bestätigen — smart je Stand */}
      <div className="space-y-2">
        {anzahlungOffen && restzahlungOffen && gesamtOffen > 0 && (
          <>
            <button
              onClick={() => postZahlung(["anzahlung", "restzahlung"], `Komplette Zahlung (${eur(gesamtOffen)})`, "komplett")}
              disabled={busy !== null}
              className="w-full py-3 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {busy === "komplett" ? "…" : `Komplett bar erhalten (${eur(gesamtOffen)})`}
            </button>
            <button
              onClick={() => postZahlung(["anzahlung"], `Anzahlung (${eur(anzahlungSoll)})`, "anzahlung")}
              disabled={busy !== null}
              className="w-full py-2 rounded-lg border border-warm-border text-warm-text text-xs font-medium hover:bg-accent-50 disabled:opacity-50"
            >
              nur Anzahlung bar ({eur(anzahlungSoll)})
            </button>
          </>
        )}
        {!anzahlungOffen && restzahlungOffen && restzahlungSoll > 0 && (
          <button
            onClick={() => postZahlung(["restzahlung"], `Restzahlung (${eur(restzahlungSoll)})`, "restzahlung")}
            disabled={busy !== null}
            className="w-full py-3 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {busy === "restzahlung" ? "…" : `Restzahlung bar erhalten (${eur(restzahlungSoll)})`}
          </button>
        )}
        {!anzahlungOffen && !restzahlungOffen && (
          <div className="text-xs text-green-700 px-1">✓ Miete vollständig bezahlt</div>
        )}
        {kautionOffen && kautionSoll > 0 && (
          <button
            onClick={() => postZahlung(["kaution"], `Kaution (${eur(kautionSoll)})`, "kaution")}
            disabled={busy !== null}
            className="w-full py-2.5 rounded-lg border border-warm-border text-warm-text text-sm font-medium hover:bg-accent-50 disabled:opacity-50"
          >
            {busy === "kaution" ? "…" : `Kaution bar/hinterlegt bestätigen (${eur(kautionSoll)})`}
          </button>
        )}
      </div>

      {/* Übergabe bestätigen */}
      <button
        onClick={uebergabeBestaetigen}
        disabled={busy !== null}
        className="w-full py-3 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-dark disabled:opacity-50"
      >
        {busy === "uebergabe" ? "…" : "✓ Übergabe bestätigen"}
      </button>

      <a href={`/admin/buchungen/${buchungId}`} className="block text-center text-xs text-warm-muted hover:text-accent">
        Details / Sonderbetrag / Foto-Doku →
      </a>
    </div>
  );
}
