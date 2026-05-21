"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  buchungId: number;
  // Initial-Werte aus Buchung/Notizen geparsed (Server-Component liefert sie)
  initialLieferung: boolean;
  initialAbholung: boolean;
  initialAufbau: boolean;
  // Adress-Display fuer den User (read-only). Wenn null → Hinweis "Adresse fehlt".
  adresseDisplay: string | null;
  // Aufbau-Summe (falls Items eingetragen) — fuer Live-Preis-Anzeige
  aufbauSummeEur: number;
}

function fmtEur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function ServicesEditor({
  buchungId,
  initialLieferung,
  initialAbholung,
  initialAufbau,
  adresseDisplay,
  aufbauSummeEur,
}: Props) {
  const router = useRouter();

  const [lieferung, setLieferung] = useState(initialLieferung);
  const [abholung, setAbholung] = useState(initialAbholung);
  const [aufbau, setAufbau] = useState(initialAufbau);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Distance einmalig beim Mount holen wenn Adresse vorhanden — als Cache fuer Live-Preis-Display
  useEffect(() => {
    if (!adresseDisplay) return;
    // Parse: "Strasse Hausnr, PLZ Ort"
    const m = adresseDisplay.match(/^(.+?)\s+(\S+)\s*,?\s*(\d{4,5})\s*(.*)$/);
    if (!m) return;
    const [, strasse, hausnr, plz, ort] = m;

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
  }, [adresseDisplay]);

  // Auto-Save bei Toggle-Change. Debounce damit schnelle Doppel-Klicks nicht zwei Requests feuern.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialMountRef = useRef(true);

  useEffect(() => {
    // Beim ersten Mount NICHT speichern — sonst wird der initial-Stand sofort ueberschrieben
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lieferung, abholung, aufbau]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/lieferung-setzen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferung,
          abholung,
          aufbau,
          distance_km: distanceKm,
          // Adresse-Felder weglassen — Server fallback aus Buchung/Kunde
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setSaveMsg({
        kind: "ok",
        text: `Gespeichert: Lieferung ${fmtEur(data.preis_lieferung as number)}, Aufbau ${fmtEur(data.preis_aufbau as number)}. Anzahlung neu berechnet.`,
      });
      router.refresh();
    } catch (e) {
      setSaveMsg({ kind: "err", text: e instanceof Error ? e.message : "Unbekannter Fehler" });
    } finally {
      setSaving(false);
    }
  }

  const lieferAktiv = lieferung || abholung;
  const lieferpreis = lieferung && distanceKm !== null ? distanceKm * 2 : 0;
  const abholpreis = abholung && distanceKm !== null ? distanceKm * 2 : 0;

  const noAdresse = !adresseDisplay && lieferAktiv;

  return (
    <section className="p-5 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Zusatzleistungen</h2>
        {saving && <span className="text-xs text-gray-400">Speichere …</span>}
      </div>

      {adresseDisplay && (
        <div className="text-xs text-gray-400 mb-3">
          Liefer-Adresse:{" "}
          <span className="text-gray-200">{adresseDisplay}</span>
          {distLoading && <span className="text-gray-500"> · Strecke wird berechnet …</span>}
          {distanceKm !== null && !distLoading && (
            <span className="text-gold-400 ml-1">
              · {distanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km
            </span>
          )}
          {distError && !distLoading && (
            <span className="text-amber-300 ml-1">· {distError}</span>
          )}
        </div>
      )}

      {!adresseDisplay && (
        <div className="text-xs text-amber-300 mb-3 p-2 rounded bg-amber-500/10 border border-amber-500/30">
          Kunden-Adresse fehlt — bitte im Kunden-Datensatz pflegen, dann kann die Strecke berechnet werden.
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-2">
        <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg bg-white/5 border border-white/10 hover:border-gold-500/30 transition-colors">
          <input
            type="checkbox"
            checked={lieferung}
            onChange={(e) => setLieferung(e.target.checked)}
            disabled={saving || noAdresse}
            className="mt-0.5 w-4 h-4 rounded border-white/20"
          />
          <div className="text-xs flex-1">
            <div className="text-white font-medium">Lieferung</div>
            <div className="text-gray-400">
              {distanceKm !== null
                ? lieferung
                  ? `+ ${fmtEur(lieferpreis)}`
                  : `bei Aktiv: + ${fmtEur(distanceKm * 2)}`
                : "Strecke unbekannt"}
            </div>
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg bg-white/5 border border-white/10 hover:border-gold-500/30 transition-colors">
          <input
            type="checkbox"
            checked={abholung}
            onChange={(e) => setAbholung(e.target.checked)}
            disabled={saving || noAdresse}
            className="mt-0.5 w-4 h-4 rounded border-white/20"
          />
          <div className="text-xs flex-1">
            <div className="text-white font-medium">Abholung</div>
            <div className="text-gray-400">
              {distanceKm !== null
                ? abholung
                  ? `+ ${fmtEur(abholpreis)}`
                  : `bei Aktiv: + ${fmtEur(distanceKm * 2)}`
                : "Strecke unbekannt"}
            </div>
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg bg-white/5 border border-white/10 hover:border-gold-500/30 transition-colors">
          <input
            type="checkbox"
            checked={aufbau}
            onChange={(e) => setAufbau(e.target.checked)}
            disabled={saving || aufbauSummeEur <= 0}
            className="mt-0.5 w-4 h-4 rounded border-white/20"
          />
          <div className="text-xs flex-1">
            <div className="text-white font-medium">Aufbau</div>
            <div className="text-gray-400">
              {aufbauSummeEur > 0
                ? aufbau
                  ? `+ ${fmtEur(aufbauSummeEur)}`
                  : `bei Aktiv: + ${fmtEur(aufbauSummeEur)}`
                : "keine Aufbau-Pauschalen"}
            </div>
          </div>
        </label>
      </div>

      {saveMsg && (
        <div
          className={`mt-3 px-3 py-2 rounded text-xs ${
            saveMsg.kind === "ok"
              ? "bg-green-500/10 border border-green-500/30 text-green-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          {saveMsg.text}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
        Klick → sofort gespeichert. Anzahlung wird neu berechnet, Stripe-Link wird ggf. regeneriert. 2 €/km pro Service
        (Lieferung + Abholung separat).
      </p>
    </section>
  );
}
