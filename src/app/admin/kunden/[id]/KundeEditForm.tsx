"use client";

import { useState } from "react";

type KundeData = {
  Vorname: string;
  Nachname: string;
  Firma: string;
  Email: string;
  Telefon: string;
  WhatsApp: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};

export default function KundeEditForm({ kundeId, initial }: { kundeId: number; initial: KundeData }) {
  const [data, setData] = useState<KundeData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function up<K extends keyof KundeData>(k: K, v: string) {
    setData((d) => ({ ...d, [k]: v }));
    setSaved(false);
  }

  async function save() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/kunde/${kundeId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, d.detail].filter(Boolean).join(" — ") || `HTTP ${res.status}`);
      } else {
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-warm-text">Stammdaten bearbeiten</h2>
        {saved && <span className="text-xs text-green-700">✓ Gespeichert</span>}
      </div>
      {error && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Vorname" value={data.Vorname} onChange={(v) => up("Vorname", v)} />
        <Field label="Nachname" value={data.Nachname} onChange={(v) => up("Nachname", v)} />
        <Field label="Firma (optional)" value={data.Firma} onChange={(v) => up("Firma", v)} fullWidth />
        <Field label="E-Mail" type="email" value={data.Email} onChange={(v) => up("Email", v)} fullWidth />
        <Field label="Telefon" type="tel" value={data.Telefon} onChange={(v) => up("Telefon", v)} />
        <Field label="WhatsApp" type="tel" value={data.WhatsApp} onChange={(v) => up("WhatsApp", v)} />
        <Field label="Straße + Hausnummer" value={data.Adresse_Strasse} onChange={(v) => up("Adresse_Strasse", v)} fullWidth />
        <div className="col-span-1">
          <Field label="PLZ" value={data.Adresse_PLZ} onChange={(v) => up("Adresse_PLZ", v)} />
        </div>
        <div className="col-span-1">
          <Field label="Ort" value={data.Adresse_Ort} onChange={(v) => up("Adresse_Ort", v)} />
        </div>
      </div>

      <button
        onClick={save}
        disabled={submitting}
        className="w-full mt-4 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Speichern …" : "Speichern"}
      </button>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : "col-span-1"}>
      <label className="block text-xs text-warm-muted mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}
