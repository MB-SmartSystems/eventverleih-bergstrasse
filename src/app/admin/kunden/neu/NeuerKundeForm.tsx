"use client";

import { useState } from "react";

export default function NeuerKundeForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/kunde/neu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vorname: String(fd.get("vorname") || "").trim(),
          nachname: String(fd.get("nachname") || "").trim(),
          firma: String(fd.get("firma") || "").trim(),
          email: String(fd.get("email") || "").trim(),
          telefon: String(fd.get("telefon") || "").trim(),
          adresse_strasse: String(fd.get("adresse_strasse") || "").trim(),
          adresse_plz: String(fd.get("adresse_plz") || "").trim(),
          adresse_ort: String(fd.get("adresse_ort") || "").trim(),
          notizen: String(fd.get("notizen") || "").trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, d.detail].filter(Boolean).join(" — "));
        setSubmitting(false);
      } else {
        window.location.href = `/admin/kunden/${d.kunde_id}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerk-Fehler");
      setSubmitting(false);
    }
  }

  const cls = "w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 rounded-xl bg-warm-surface border border-warm-border">
      {error && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-warm-muted mb-1">Vorname *</label>
          <input name="vorname" required className={cls} />
        </div>
        <div>
          <label className="block text-xs text-warm-muted mb-1">Nachname *</label>
          <input name="nachname" required className={cls} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-muted mb-1">Firma (optional)</label>
        <input name="firma" className={cls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-warm-muted mb-1">E-Mail *</label>
          <input type="email" name="email" required className={cls} />
        </div>
        <div>
          <label className="block text-xs text-warm-muted mb-1">Telefon</label>
          <input type="tel" name="telefon" className={cls} />
        </div>
      </div>
      <div className="pt-3 border-t border-warm-border">
        <div className="text-xs text-warm-muted mb-2">Anschrift (optional)</div>
        <input name="adresse_strasse" placeholder="Strasse + Hausnummer" className={cls + " mb-2"} />
        <div className="grid grid-cols-3 gap-2">
          <input name="adresse_plz" placeholder="PLZ" className={cls} />
          <input name="adresse_ort" placeholder="Ort" className={cls + " col-span-2"} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-muted mb-1">Notizen</label>
        <textarea name="notizen" rows={3} className={cls + " resize-none"} />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded bg-accent text-white text-sm font-semibold hover:bg-accent-dark disabled:opacity-40"
      >
        {submitting ? "Wird angelegt…" : "Kunde anlegen"}
      </button>
    </form>
  );
}
