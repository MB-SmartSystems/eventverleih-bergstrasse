"use client";

import { useState } from "react";
import DateRangePicker from "@/components/DateRangePicker";
import { formatGermanShort } from "@/lib/eventverleih/constants";

interface KundeOption {
  id: number;
  label: string;
  email: string;
  telefon: string;
}
interface ArtikelOption {
  id: number;
  bezeichnung: string;
  preis: number;
}
interface CartItem {
  artikel_id: number;
  bezeichnung: string;
  preis: number;
  anzahl: number;
}

type KundeMode = "existing" | "new";

export default function NeueAnfrageForm({
  kunden,
  artikel,
}: {
  kunden: KundeOption[];
  artikel: ArtikelOption[];
}) {
  const [kundeMode, setKundeMode] = useState<KundeMode>("existing");
  const [kundeId, setKundeId] = useState<number | "">("");
  const [neuerKunde, setNeuerKunde] = useState({
    vorname: "",
    nachname: "",
    email: "",
    telefon: "",
  });
  const [vonIso, setVonIso] = useState<string | null>(null);
  const [bisIso, setBisIso] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [artikelToAdd, setArtikelToAdd] = useState<number | "">("");
  const [anzahlToAdd, setAnzahlToAdd] = useState(1);
  const [notiz, setNotiz] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addItem() {
    if (!artikelToAdd) return;
    const a = artikel.find((x) => x.id === artikelToAdd);
    if (!a) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.artikel_id === a.id);
      if (existing) {
        return prev.map((c) => c.artikel_id === a.id ? { ...c, anzahl: c.anzahl + anzahlToAdd } : c);
      }
      return [...prev, { artikel_id: a.id, bezeichnung: a.bezeichnung, preis: a.preis, anzahl: anzahlToAdd }];
    });
    setArtikelToAdd("");
    setAnzahlToAdd(1);
  }

  function removeItem(id: number) {
    setCart((prev) => prev.filter((c) => c.artikel_id !== id));
  }

  function updateAnzahl(id: number, anzahl: number) {
    setCart((prev) => prev.map((c) => c.artikel_id === id ? { ...c, anzahl } : c));
  }

  const cartSum = cart.reduce((s, c) => s + c.preis * c.anzahl, 0);

  async function submit() {
    setError("");
    if (kundeMode === "existing" && !kundeId) {
      setError("Bitte einen Kunden auswaehlen oder 'Neuer Kunde' anlegen.");
      return;
    }
    if (kundeMode === "new") {
      if (!neuerKunde.vorname.trim() || !neuerKunde.nachname.trim()) {
        setError("Vor- und Nachname sind Pflicht beim Neuanlegen.");
        return;
      }
      if (!neuerKunde.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(neuerKunde.email.trim())) {
        setError("Gueltige E-Mail-Adresse erforderlich (fuer Angebots-Versand).");
        return;
      }
    }
    if (!vonIso || !bisIso) { setError("Bitte Mietzeitraum auswaehlen."); return; }
    if (bisIso < vonIso) { setError("Bis-Datum muss nach Von-Datum liegen."); return; }
    if (cart.length === 0) { setError("Bitte mindestens einen Artikel hinzufuegen."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/anfrage/neu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kunde_id: kundeMode === "existing" ? kundeId : undefined,
          kunde_neu: kundeMode === "new" ? neuerKunde : undefined,
          event_datum_von: vonIso,
          event_datum_bis: bisIso,
          cart_items: cart.map((c) => ({ artikel_id: c.artikel_id, anzahl: c.anzahl })),
          notiz,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, d.detail].filter(Boolean).join(" — "));
        setSubmitting(false);
      } else {
        window.location.href = `/admin/buchungen/${d.buchung_id}`;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
      setSubmitting(false);
    }
  }

  const kundeSelected = kunden.find((k) => k.id === kundeId);
  const cls = "w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="space-y-5">
      {/* Tim-Ferriss-Hinweis (4-Stunden-Woche-Pattern) */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-900">
        <div className="font-semibold mb-1">💡 Lieber den Kunden aufs Web-Formular schicken</div>
        <p className="text-blue-800/90">
          Tim-Ferriss-Prinzip: Manuell-Anlage kostet dich Zeit. Bevor du hier loslegst — bitte
          dein Telefon-/WhatsApp-Gegenueber kurz auf eventverleih-bergstrasse.de zu gehen. Spart
          dir 5-10 Min und du bekommst die Daten exakt wie der Kunde sie meint. Nur wenn das
          partout nicht geht, hier weiter machen.
        </p>
      </div>

      <div className="space-y-5 p-5 rounded-xl bg-warm-surface border border-warm-border">
        {error && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Kunde-Selektor mit Mode-Toggle */}
        <div>
          <label className="block text-sm text-warm-muted mb-2 font-medium">Kunde</label>
          <div className="inline-flex rounded-lg border border-warm-border bg-warm-bg p-1 mb-3 text-sm">
            <button
              type="button"
              onClick={() => setKundeMode("existing")}
              className={`px-3 py-1 rounded transition-colors ${kundeMode === "existing" ? "bg-accent text-white" : "text-warm-muted hover:text-warm-text"}`}
            >
              Vorhandenen Kunden waehlen
            </button>
            <button
              type="button"
              onClick={() => setKundeMode("new")}
              className={`px-3 py-1 rounded transition-colors ${kundeMode === "new" ? "bg-accent text-white" : "text-warm-muted hover:text-warm-text"}`}
            >
              Neuen Kunden anlegen
            </button>
          </div>

          {kundeMode === "existing" ? (
            <>
              <select
                value={kundeId}
                onChange={(e) => setKundeId(e.target.value ? parseInt(e.target.value, 10) : "")}
                className={cls}
              >
                <option value="">— bitte waehlen —</option>
                {kunden.map((k) => (
                  <option key={k.id} value={k.id}>{k.label} {k.email ? `(${k.email})` : ""}</option>
                ))}
              </select>
              {kundeSelected && (
                <p className="text-xs text-warm-muted mt-1">
                  {kundeSelected.email} {kundeSelected.telefon ? `· ${kundeSelected.telefon}` : ""}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3 p-3 rounded-lg bg-warm-bg/40 border border-warm-border">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-warm-muted mb-1">Vorname *</label>
                  <input
                    value={neuerKunde.vorname}
                    onChange={(e) => setNeuerKunde({ ...neuerKunde, vorname: e.target.value })}
                    className={cls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-warm-muted mb-1">Nachname *</label>
                  <input
                    value={neuerKunde.nachname}
                    onChange={(e) => setNeuerKunde({ ...neuerKunde, nachname: e.target.value })}
                    className={cls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-warm-muted mb-1">E-Mail *</label>
                  <input
                    type="email"
                    value={neuerKunde.email}
                    onChange={(e) => setNeuerKunde({ ...neuerKunde, email: e.target.value })}
                    className={cls}
                    placeholder="fuer Angebots-Versand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-warm-muted mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={neuerKunde.telefon}
                    onChange={(e) => setNeuerKunde({ ...neuerKunde, telefon: e.target.value })}
                    className={cls}
                  />
                </div>
              </div>
              <p className="text-xs text-warm-muted">
                Wird im Kunden-Verzeichnis angelegt. Adresse kann der Kunde spaeter im Member-Bereich oder beim Angebot-Bestaetigen selbst ergaenzen.
              </p>
            </div>
          )}
        </div>

        {/* Mietzeitraum */}
        <div>
          <label className="block text-sm text-warm-muted mb-1 font-medium">Mietzeitraum</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm hover:bg-warm-border/30 transition-colors"
            >
              {vonIso && bisIso
                ? `${formatGermanShort(vonIso)} — ${formatGermanShort(bisIso)}`
                : "Zeitraum auswaehlen"}
            </button>
            {(vonIso || bisIso) && (
              <button
                type="button"
                onClick={() => { setVonIso(null); setBisIso(null); }}
                className="text-xs text-warm-muted hover:text-warm-text underline"
              >
                zuruecksetzen
              </button>
            )}
          </div>
          {pickerOpen && (
            <div className="mt-3 p-4 rounded-lg border border-warm-border bg-warm-bg/40 inline-block">
              <DateRangePicker
                variant="admin"
                rangeVon={vonIso}
                rangeBis={bisIso}
                onChange={(von, bis) => {
                  setVonIso(von);
                  setBisIso(bis);
                  if (von && bis) {
                    window.setTimeout(() => setPickerOpen(false), 250);
                  }
                }}
              />
              <p className="text-xs text-warm-muted mt-2">
                Admin-Variante: Vergangenheits-Daten erlaubt (z.B. Nacherfassung).
              </p>
            </div>
          )}
        </div>

        {/* Cart */}
        <div>
          <label className="block text-sm text-warm-muted mb-1 font-medium">Artikel</label>
          <div className="flex gap-2 mb-3">
            <select
              value={artikelToAdd}
              onChange={(e) => setArtikelToAdd(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="flex-1 px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">— Artikel waehlen —</option>
              {artikel.map((a) => (
                <option key={a.id} value={a.id}>{a.bezeichnung} ({a.preis.toFixed(2)} €)</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={anzahlToAdd}
              onChange={(e) => setAnzahlToAdd(parseInt(e.target.value, 10) || 1)}
              className="w-20 px-2 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!artikelToAdd}
              className="px-4 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40"
            >
              + Add
            </button>
          </div>
          {cart.length > 0 ? (
            <div className="space-y-2">
              {cart.map((c) => (
                <div key={c.artikel_id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1">{c.bezeichnung}</div>
                  <input
                    type="number"
                    min="1"
                    value={c.anzahl}
                    onChange={(e) => updateAnzahl(c.artikel_id, parseInt(e.target.value, 10) || 1)}
                    className="w-16 px-2 py-1 rounded border border-warm-border bg-warm-bg text-warm-text text-xs"
                  />
                  <div className="w-20 text-right text-warm-text font-mono">{(c.preis * c.anzahl).toFixed(2)} €</div>
                  <button
                    type="button"
                    onClick={() => removeItem(c.artikel_id)}
                    className="text-red-600 hover:text-red-700 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex items-center pt-2 border-t border-warm-border text-sm font-semibold">
                <div className="flex-1">Mietsumme</div>
                <div className="w-20 text-right text-warm-text">{cartSum.toFixed(2)} €</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-warm-muted italic">Noch keine Artikel hinzugefuegt.</p>
          )}
        </div>

        {/* Notiz */}
        <div>
          <label className="block text-sm text-warm-muted mb-1 font-medium">Anmerkungen / Telefon-Notizen</label>
          <textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={3}
            placeholder="z.B. Kunde hat angerufen am 20.05., will Hochzeit am 15.06., evtl. Lieferung benoetigt..."
            className="w-full px-3 py-2 rounded border border-warm-border bg-warm-bg text-warm-text text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-3 rounded bg-accent text-white text-sm font-semibold hover:bg-accent-dark disabled:opacity-40 transition-colors"
        >
          {submitting ? "Anfrage wird angelegt…" : "Anfrage anlegen"}
        </button>
        <p className="text-xs text-warm-muted text-center">
          Es wird keine Auto-Reply-Mail an den Kunden geschickt. Du entscheidest danach, ob du das Angebot freigibst.
        </p>
      </div>
    </div>
  );
}
