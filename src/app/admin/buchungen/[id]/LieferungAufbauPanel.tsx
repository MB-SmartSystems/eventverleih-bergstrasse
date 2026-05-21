"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  buchungId: number;
  initialPreisLieferung: number;
  initialPreisAufbau: number;
  initialLieferadresse: string | null;
  // Kunden-Adresse aus dem Kunden-Datensatz als Default-Vorbelegung
  kundeStrasse: string;
  kundeHausnr: string;
  kundePlz: string;
  kundeOrt: string;
}

function parseAdresse(s: string | null): { strasse: string; hausnr: string; plz: string; ort: string } {
  if (!s) return { strasse: "", hausnr: "", plz: "", ort: "" };
  // Format aus dem Cart: "Strasse Hausnr, PLZ" — pragmatisch parsen
  const m = s.match(/^(.+?)\s+(\S+)\s*,?\s*(\d{4,5})\s*(.*)$/);
  if (m) return { strasse: m[1].trim(), hausnr: m[2].trim(), plz: m[3].trim(), ort: m[4].trim() };
  return { strasse: s, hausnr: "", plz: "", ort: "" };
}

export default function LieferungAufbauPanel({
  buchungId,
  initialPreisLieferung,
  initialPreisAufbau,
  initialLieferadresse,
  kundeStrasse,
  kundeHausnr,
  kundePlz,
  kundeOrt,
}: Props) {
  const router = useRouter();

  // Initiale Settings aus Buchung ableiten
  // Wenn Preis_Lieferung > 0 → war Lieferung oder Abholung aktiv. Unterscheidung nicht aus Buchung
  // direkt erkennbar — User muss neu entscheiden.
  const [lieferung, setLieferung] = useState(initialPreisLieferung > 0);
  const [abholung, setAbholung] = useState(false);
  const [aufbau, setAufbau] = useState(initialPreisAufbau > 0);

  const adrInitial = parseAdresse(initialLieferadresse);
  const [strasse, setStrasse] = useState(adrInitial.strasse || kundeStrasse);
  const [hausnr, setHausnr] = useState(adrInitial.hausnr || kundeHausnr);
  const [plz, setPlz] = useState(adrInitial.plz || kundePlz);
  const [ort, setOrt] = useState(adrInitial.ort || kundeOrt);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const adrKomplett = strasse.trim().length > 1 && hausnr.trim().length > 0 && /^\d{4,5}$/.test(plz);
  const lieferAktiv = lieferung || abholung;

  // Auto-Distance-Lookup wenn Adresse komplett und Lieferung/Abholung aktiv
  useEffect(() => {
    if (!lieferAktiv || !adrKomplett) {
      setDistanceKm(null);
      return;
    }
    let cancelled = false;
    setDistLoading(true);
    setDistError(null);
    fetch("/api/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strasse, hausnr, plz, ort }),
    })
      .then((r) => r.json())
      .then((d: { km?: number; gefunden?: boolean; details?: string }) => {
        if (cancelled) return;
        if (d.gefunden && typeof d.km === "number" && d.km > 0) {
          setDistanceKm(d.km);
        } else {
          setDistError(d.details || "Adresse nicht gefunden");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDistError("Strecken-Abruf fehlgeschlagen");
      })
      .finally(() => {
        if (!cancelled) setDistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lieferAktiv, adrKomplett, strasse, hausnr, plz, ort]);

  const lieferpreis = lieferung && distanceKm !== null ? distanceKm * 2 : 0;
  const abholpreis = abholung && distanceKm !== null ? distanceKm * 2 : 0;
  const summe = lieferpreis + abholpreis;

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/lieferung-setzen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferung,
          abholung,
          aufbau,
          distance_km: distanceKm,
          liefer_strasse: lieferAktiv ? strasse.trim() : undefined,
          liefer_hausnr: lieferAktiv ? hausnr.trim() : undefined,
          liefer_plz: lieferAktiv ? plz.trim() : undefined,
          liefer_ort: lieferAktiv ? ort.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      setSaveOk(
        `Gespeichert: Lieferung ${(data.preis_lieferung as number).toFixed(2)} €, Aufbau ${(data.preis_aufbau as number).toFixed(2)} €. Anzahlung wurde neu berechnet, Stripe-Link aktualisiert falls vorhanden.`,
      );
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-4">
      <h2 className="text-lg font-semibold text-warm-text">Lieferung &amp; Aufbau nachtraglich</h2>

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={lieferung}
            onChange={(e) => setLieferung(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-warm-border"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-warm-text">
              Lieferung zum Event
              {distanceKm !== null && lieferung && (
                <span className="text-accent-dark"> (+ {lieferpreis.toFixed(2)} €)</span>
              )}
            </div>
            <p className="text-xs text-warm-muted">2 € / km einfache Strecke ab Schlesierstr 19a, Alsbach-Hähnlein.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={abholung}
            onChange={(e) => setAbholung(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-warm-border"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-warm-text">
              Abholung nach Event
              {distanceKm !== null && abholung && (
                <span className="text-accent-dark"> (+ {abholpreis.toFixed(2)} €)</span>
              )}
            </div>
            <p className="text-xs text-warm-muted">2 € / km einfache Strecke.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={aufbau}
            onChange={(e) => setAufbau(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-warm-border"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-warm-text">
              Aufbau-Service (Komplettpaket)
            </div>
            <p className="text-xs text-warm-muted">
              Pauschale = Summe aller Aufbau-Pauschalen der Buchungs-Positionen × Anzahl.
            </p>
          </div>
        </label>
      </div>

      {lieferAktiv && (
        <div className="space-y-3 p-3 rounded-lg border border-warm-border bg-warm-bg/30">
          <div className="text-xs font-medium text-warm-muted">Event-Adresse</div>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <input
              type="text"
              value={strasse}
              onChange={(e) => setStrasse(e.target.value)}
              placeholder="Straße"
              className="px-2 py-1.5 rounded border border-warm-border text-sm"
            />
            <input
              type="text"
              value={hausnr}
              onChange={(e) => setHausnr(e.target.value)}
              placeholder="Hausnr."
              className="px-2 py-1.5 rounded border border-warm-border text-sm"
            />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <input
              type="text"
              value={plz}
              onChange={(e) => setPlz(e.target.value)}
              placeholder="PLZ"
              maxLength={5}
              className="px-2 py-1.5 rounded border border-warm-border text-sm"
            />
            <input
              type="text"
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder="Ort"
              className="px-2 py-1.5 rounded border border-warm-border text-sm"
            />
          </div>
          {distLoading && <p className="text-xs text-warm-muted">Strecke wird berechnet …</p>}
          {distanceKm !== null && !distLoading && (
            <p className="text-xs text-accent-dark font-medium">
              Strecke: {distanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km — Lieferung + Abholung
              gesamt: {summe.toFixed(2)} €
            </p>
          )}
          {distError && !distLoading && (
            <p className="text-xs text-red-600">{distError}. Manuell setzen oder Adresse korrigieren.</p>
          )}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || (lieferAktiv && distanceKm === null)}
        className="w-full text-sm px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 transition-colors"
      >
        {saving ? "Speichere …" : "Speichern + Anzahlung neu berechnen"}
      </button>

      {saveOk && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{saveOk}</p>}
      {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{saveError}</p>}

      <p className="text-xs text-warm-muted leading-relaxed">
        Speichert Preis_Lieferung + Preis_Aufbau + Liefer-Adresse. recalcBuchung() berechnet Anzahlung neu und
        regeneriert den Stripe-Anzahlungs-Link, falls er bereits existiert.
      </p>
    </section>
  );
}
