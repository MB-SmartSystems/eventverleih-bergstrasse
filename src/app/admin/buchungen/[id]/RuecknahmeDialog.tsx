"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Position {
  id: number;
  name: string;
  anzahl: number;
}

interface RuecknahmeDialogProps {
  buchungId: number;
  positionen: Position[];
  hasKautionPreAuth: boolean;
  kautionSollEur?: number;
}

interface SchadenItem {
  position_id?: number;
  beschreibung: string;
  betrag_eur: number;
}

export default function RuecknahmeDialog({
  buchungId,
  positionen,
  hasKautionPreAuth,
  kautionSollEur,
}: RuecknahmeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [zustand, setZustand] = useState<Record<number, "ok" | "fehlt" | "schaden">>({});
  const [schaden, setSchaden] = useState<SchadenItem[]>([]);
  const [kautionAufloesung, setKautionAufloesung] = useState<"cancel" | "capture_full" | "capture_partial">(
    "cancel",
  );
  const [kautionCaptureEur, setKautionCaptureEur] = useState(0);
  const [notiz, setNotiz] = useState("");

  async function uploadFoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/buchung/${buchungId}/upload-foto?type=ruecknahme`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");
      setFotoUrls((prev) => [...prev, data.url]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  function addSchaden() {
    setSchaden((prev) => [...prev, { beschreibung: "", betrag_eur: 0 }]);
  }
  function updateSchaden(i: number, patch: Partial<SchadenItem>) {
    setSchaden((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeSchaden(i: number) {
    setSchaden((prev) => prev.filter((_, idx) => idx !== i));
  }

  const schadenSumme = schaden.reduce((sum, s) => sum + (s.betrag_eur || 0), 0);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/ruecknahme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foto_urls: fotoUrls,
          schaden,
          schaden_betrag_eur: schadenSumme,
          kaution_aufloesung: kautionAufloesung,
          kaution_capture_eur: kautionCaptureEur,
          notiz,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "submit failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-white text-sm font-medium hover:bg-accent-dark"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Rückgabe markieren
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-warm-surface w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-warm-surface border-b border-warm-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-display font-semibold text-warm-text">Rückgabe Buchung #{buchungId}</h2>
          <button onClick={() => setOpen(false)} className="text-warm-muted">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Fotos */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">
              Fotos vom Zustand bei Rückgabe ({fotoUrls.length})
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => e.target.files && Array.from(e.target.files).forEach(uploadFoto)}
              className="block w-full text-sm text-warm-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent-light file:text-accent-dark"
            />
            {uploading && <p className="text-xs text-warm-muted mt-1">Lade hoch...</p>}
            {fotoUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {fotoUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Foto ${i + 1}`} className="rounded h-16 w-full object-cover" />
                ))}
              </div>
            )}
          </div>

          {/* Zustand pro Position */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">Zustand pro Position</label>
            <div className="space-y-1">
              {positionen.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-warm-border">
                  <span className="text-sm text-warm-text flex-1">{p.name}</span>
                  <select
                    value={zustand[p.id] || "ok"}
                    onChange={(e) =>
                      setZustand((prev) => ({ ...prev, [p.id]: e.target.value as "ok" | "fehlt" | "schaden" }))
                    }
                    className="text-xs px-2 py-1 rounded border border-warm-border"
                  >
                    <option value="ok">OK</option>
                    <option value="fehlt">Fehlt</option>
                    <option value="schaden">Schaden</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Schaden-Liste */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-warm-text">
                Schäden (Summe: {schadenSumme.toFixed(2)} €)
              </label>
              <button
                type="button"
                onClick={addSchaden}
                className="text-xs text-accent-dark hover:underline"
              >
                + Schaden erfassen
              </button>
            </div>
            {schaden.length === 0 ? (
              <p className="text-xs text-warm-muted italic">Keine Schäden — alles in Ordnung.</p>
            ) : (
              <div className="space-y-2">
                {schaden.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Beschreibung"
                      value={s.beschreibung}
                      onChange={(e) => updateSchaden(i, { beschreibung: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg border border-warm-border text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="EUR"
                      value={s.betrag_eur}
                      onChange={(e) => updateSchaden(i, { betrag_eur: Number(e.target.value) })}
                      className="w-24 px-3 py-2 rounded-lg border border-warm-border text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeSchaden(i)}
                      className="text-red-600 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kaution-Auflösung */}
          {hasKautionPreAuth && (
            <div>
              <label className="block text-sm font-medium text-warm-text mb-1">
                Kaution-Hold ({kautionSollEur} €) auflösen
              </label>
              <div className="flex gap-2 flex-wrap">
                {(["cancel", "capture_full", "capture_partial"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setKautionAufloesung(m);
                      if (m === "capture_partial" && schadenSumme > 0) {
                        setKautionCaptureEur(schadenSumme);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      kautionAufloesung === m
                        ? "bg-accent text-white border-accent"
                        : "bg-warm-surface text-warm-muted border-warm-border"
                    }`}
                  >
                    {m === "cancel" ? "Komplett zurück" : m === "capture_full" ? "Komplett einbehalten" : "Teil einbehalten"}
                  </button>
                ))}
              </div>
              {kautionAufloesung === "capture_partial" && (
                <input
                  type="number"
                  step="0.01"
                  value={kautionCaptureEur}
                  onChange={(e) => setKautionCaptureEur(Number(e.target.value))}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-warm-border text-sm"
                  placeholder="Einbehaltener Betrag in EUR"
                />
              )}
            </div>
          )}

          {/* Notiz */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Notiz (optional)</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-warm-border text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-warm-surface border-t border-warm-border p-4 flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-warm-border text-warm-text"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-dark disabled:opacity-50"
          >
            {submitting ? "Speichere..." : "Rückgabe abschließen"}
          </button>
        </div>
      </div>
    </div>
  );
}
