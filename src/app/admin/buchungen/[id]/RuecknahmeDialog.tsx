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
}

/**
 * Moment 1 der Rückgabe — am Treffpunkt, auf dem Handy.
 * NUR Vollständigkeit pro Artikel (da/fehlt) + optional Fotos. KEINE Schaden-Erfassung,
 * KEINE Kaution-Auflösung, KEINE Mail. Status → "Zurueckgegeben", Kaution bleibt offen
 * (2-Werktage-Prüffrist). Schäden prüfen + Kaution abrechnen + Abschluss-Mail = Moment 2
 * (Kaution-Erstatten-Panel).
 */
export default function RuecknahmeDialog({ buchungId, positionen }: RuecknahmeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [vollst, setVollst] = useState<Record<number, "da" | "fehlt">>({});
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

  const fehltCount = positionen.filter((p) => vollst[p.id] === "fehlt").length;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const vollstaendigkeit = positionen.map((p) => ({
        position_id: p.id,
        name: p.name,
        anzahl: p.anzahl,
        status: vollst[p.id] === "fehlt" ? "fehlt" : "da",
      }));
      const res = await fetch(`/api/admin/buchung/${buchungId}/ruecknahme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foto_urls: fotoUrls,
          vollstaendigkeit,
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
          <p className="text-sm text-warm-muted">
            Geh die Artikel mit dem Kunden durch und hake ab, was zurück ist. Schäden prüfst du
            später in Ruhe — die Kaution rechnest du erst danach ab.
          </p>

          {/* Vollständigkeit pro Position */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">
              Alles zurück? {fehltCount > 0 && <span className="text-red-600">({fehltCount} fehlt)</span>}
            </label>
            <div className="space-y-1">
              {positionen.map((p) => {
                const st = vollst[p.id] === "fehlt" ? "fehlt" : "da";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-warm-border">
                    <span className="text-sm text-warm-text flex-1">
                      {p.anzahl}× {p.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setVollst((prev) => ({ ...prev, [p.id]: "da" }))}
                        className={`px-3 py-1 rounded text-xs font-medium border ${
                          st === "da"
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-warm-surface text-warm-muted border-warm-border"
                        }`}
                      >
                        Da
                      </button>
                      <button
                        type="button"
                        onClick={() => setVollst((prev) => ({ ...prev, [p.id]: "fehlt" }))}
                        className={`px-3 py-1 rounded text-xs font-medium border ${
                          st === "fehlt"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-warm-surface text-warm-muted border-warm-border"
                        }`}
                      >
                        Fehlt
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fotos (optional) */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">
              Fotos (optional, {fotoUrls.length})
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

          {/* Notiz */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-1">Notiz (optional, intern)</label>
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
