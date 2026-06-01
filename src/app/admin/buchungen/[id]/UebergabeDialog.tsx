"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Position {
  id: number;
  name: string;
  anzahl: number;
}

interface UebergabeDialogProps {
  buchungId: number;
  positionen: Position[];
  uebergabeAdresse?: string;
  kautionSollEur?: number;
}

interface ChecklistItem {
  position_id: number;
  name: string;
  ok: boolean;
  notiz?: string;
}

export default function UebergabeDialog({
  buchungId,
  positionen,
  uebergabeAdresse,
  kautionSollEur,
}: UebergabeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [checkliste, setCheckliste] = useState<ChecklistItem[]>(
    positionen.map((p) => ({ position_id: p.id, name: p.name, ok: false })),
  );
  const [adresse, setAdresse] = useState(uebergabeAdresse || "");
  const [kautionMethode, setKautionMethode] = useState<"stripe_preauth" | "bar" | "keine">(
    kautionSollEur ? "stripe_preauth" : "keine",
  );
  const [kautionEur, setKautionEur] = useState(kautionSollEur || 0);
  const [notiz, setNotiz] = useState("");

  async function uploadFoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/buchung/${buchungId}/upload-foto?type=uebergabe`, {
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

  function setOk(positionId: number, ok: boolean) {
    setCheckliste((prev) =>
      prev.map((c) => (c.position_id === positionId ? { ...c, ok } : c)),
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/uebergabe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foto_urls: fotoUrls,
          checkliste,
          uebergabe_adresse: adresse,
          kaution_methode: kautionMethode,
          kaution_eur: kautionEur,
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
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-white text-sm font-medium hover:bg-accent-dark transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Übergabe markieren
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-warm-surface w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-warm-surface border-b border-warm-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-display font-semibold text-warm-text">Übergabe Buchung #{buchungId}</h2>
          <button onClick={() => setOpen(false)} className="text-warm-muted hover:text-warm-text">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Foto-Upload */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">
              Fotos vom Zustand ({fotoUrls.length})
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  Array.from(e.target.files).forEach(uploadFoto);
                }
              }}
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

          {/* Checkliste */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">
              Checkliste ({checkliste.filter((c) => c.ok).length}/{checkliste.length})
            </label>
            <div className="space-y-1">
              {checkliste.map((c) => (
                <label key={c.position_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-warm-bg/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.ok}
                    onChange={(e) => setOk(c.position_id, e.target.checked)}
                    className="w-5 h-5 rounded border-warm-border text-accent"
                  />
                  <span className={c.ok ? "line-through text-warm-muted" : "text-warm-text"}>{c.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Übergabe-Adresse */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Übergabe-Adresse</label>
            <textarea
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Straße, Ort"
            />
          </div>

          {/* Kaution */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Kaution</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {(["stripe_preauth", "bar", "keine"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setKautionMethode(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    kautionMethode === m
                      ? "bg-accent text-white border-accent"
                      : "bg-warm-surface text-warm-muted border-warm-border"
                  }`}
                >
                  {m === "stripe_preauth" ? "Stripe-Hold" : m === "bar" ? "Bar" : "Keine"}
                </button>
              ))}
            </div>
            {kautionMethode !== "keine" && (
              <input
                type="number"
                value={kautionEur}
                onChange={(e) => setKautionEur(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-warm-border text-sm"
                placeholder="Betrag in EUR"
              />
            )}
          </div>

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
            {submitting ? "Speichere..." : "Übergeben"}
          </button>
        </div>
      </div>
    </div>
  );
}
