"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import DateRangeSheet from "./DateRangeSheet";
import { formatGerman, rangeDays, rundeKaution, AUFBAU_HELFER_HINWEIS } from "@/lib/eventverleih/constants";
import type { RentalProduct, ProductsData } from "@/lib/types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "a", ö: "o", ü: "u", ß: "ss" }[c] || c))
    .replace(/×/g, "x")
    .replace(/[—–−]/g, "-")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchProduct(itemName: string, products: RentalProduct[]): RentalProduct | null {
  const target = normalize(itemName);
  const direct = products.find((p) => normalize(p.name) === target);
  if (direct) return direct;
  const partial = products.find((p) => {
    const n = normalize(p.name);
    return n.includes(target) || target.includes(n);
  });
  return partial || null;
}

function formatEur(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// Parst Cart-Item-Preis-String ("45,00 €" / "45 €") → number. Auf-Anfrage (0/leer/invalid) → null.
function parsePriceString(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, "").replace(/€/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

export default function CartPage() {
  const {
    items,
    totalItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    rangeVon,
    rangeBis,
    clearRange,
    hydrated,
    aufbauKomplett,
    setAufbauKomplett,
    lieferungGewuenscht,
    abholungGewuenscht,
    setLieferungGewuenscht,
    setAbholungGewuenscht,
    lieferStrasse,
    lieferHausnr,
    setLieferAdresse,
    distanceKm,
    setDistanceKm,
  } = useCart();

  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);

  // Form-State
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [plz, setPlz] = useState("");
  const [notiz, setNotiz] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [website, setWebsite] = useState(""); // Honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"idle" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d: ProductsData) => {
        setProducts(d.products || []);
        setProductsLoaded(true);
      })
      .catch(() => setProductsLoaded(true));
  }, []);

  const hasRange = Boolean(rangeVon && rangeBis);
  const dauerTage = hasRange ? rangeDays(rangeVon!, rangeBis!) + 1 : 0;

  // Pricing-Berechnung pro Item.
  // Fail-soft: wenn Baserow-Pricing nicht verfuegbar (Timeout, Name-Mismatch), nutze die
  // CartItem-Price-String-Variante (kam vom Sortiment-Display). Kaution + Aufbau sind
  // nur via Baserow verfuegbar; ohne Match werden sie 0 angezeigt.
  const itemPricing = useMemo(() => {
    return items.map((item) => {
      const product = matchProduct(item.name, products);
      const fallbackMiet = parsePriceString(item.price);
      const mietpreis = product?.mietpreisEur ?? fallbackMiet;
      const kaution = product?.kautionEur ?? null;
      const aufbau = product?.aufbauEur ?? null;
      const mietsumme = mietpreis !== null ? mietpreis * item.quantity : null;
      const kautionsumme = kaution !== null ? kaution * item.quantity : 0;
      return {
        item,
        product,
        mietpreis,
        kaution,
        aufbau,
        mietsumme,
        kautionsumme,
        // Aufbau-Summe pro Item (×anzahl), wird zur Cart-Gesamtsumme aufaddiert
        // wenn der globale aufbauKomplett-Toggle aktiv ist.
        aufbauSummeProItem: aufbau !== null && aufbau > 0 ? aufbau * item.quantity : 0,
        aufAnfrage: mietpreis === null,
        pricingPartial: product === null || product?.mietpreisEur === null,
      };
    });
  }, [items, products]);

  const totalMiete = itemPricing.reduce((s, p) => s + (p.mietsumme ?? 0), 0);
  const totalKaution = rundeKaution(itemPricing.reduce((s, p) => s + p.kautionsumme, 0));
  const aufbauSumme = itemPricing.reduce((s, p) => s + p.aufbauSummeProItem, 0);
  const totalAufbau = aufbauKomplett ? aufbauSumme : 0;

  // Liefer-Preise: 2 €/km pro Service-Operation; angefangene km werden aufgerundet
  const billKm = distanceKm !== null ? Math.ceil(distanceKm) : 0;
  const lieferpreis = lieferungGewuenscht && distanceKm !== null ? billKm * 2 : 0;
  const abholpreis = abholungGewuenscht && distanceKm !== null ? billKm * 2 : 0;

  const totalGesamt = totalMiete + totalKaution + totalAufbau + lieferpreis + abholpreis;
  const aufAnfrageCount = itemPricing.filter((p) => p.aufAnfrage).length;
  const aufbauVerfuegbar = aufbauSumme > 0;
  // Aufbau-Helfer-Hinweis: nur wenn ein Faltzelt im Warenkorb ist UND Aufbau gebucht wird
  // (Faltzelt nicht sicher allein aufbaubar; den Rest baut Manuel allein auf).
  const hatFaltzelt = itemPricing.some((p) => /faltzelt/i.test(p.item.name));
  const zeigeAufbauHelfer = hatFaltzelt && aufbauKomplett && aufbauVerfuegbar;
  const lieferAktiv = lieferungGewuenscht || abholungGewuenscht;
  const lieferAdresseKomplett =
    lieferStrasse.trim().length > 1 &&
    lieferHausnr.trim().length > 0 &&
    /^\d{4,5}$/.test(plz);

  // Auto-Distance-Lookup wenn Adresse komplett UND Lieferung/Abholung aktiv UND noch kein Cache
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  useEffect(() => {
    if (!lieferAktiv || !lieferAdresseKomplett || distanceKm !== null) return;
    let cancelled = false;
    setDistanceLoading(true);
    setDistanceError(null);
    fetch("/api/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strasse: lieferStrasse,
        hausnr: lieferHausnr,
        plz,
        ort: "",
      }),
    })
      .then((r) => r.json())
      .then((d: { km?: number; gefunden?: boolean; details?: string }) => {
        if (cancelled) return;
        if (d.gefunden && typeof d.km === "number" && d.km > 0) {
          setDistanceKm(d.km);
        } else {
          setDistanceError(d.details || "Adresse nicht gefunden");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDistanceError("Strecken-Abruf fehlgeschlagen");
      })
      .finally(() => {
        if (!cancelled) setDistanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lieferAktiv, lieferAdresseKomplett, lieferStrasse, lieferHausnr, plz, distanceKm, setDistanceKm]);

  const canSubmit = agreed && hasRange && items.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (website.trim() !== "") {
      setSubmitResult("success");
      return;
    }
    if (!hasRange) {
      setErrorText("Bitte wählen Sie einen Mietzeitraum.");
      setSubmitResult("error");
      return;
    }
    if (items.length === 0) {
      setErrorText("Ihr Warenkorb ist leer.");
      setSubmitResult("error");
      return;
    }
    if (!/^\d{4,5}$/.test(plz)) {
      setErrorText("Bitte eine gültige Postleitzahl angeben (4-5 Ziffern).");
      setSubmitResult("error");
      return;
    }

    // Nachricht: Cart-Liste + Aufbau + Lieferung/Abholung-Markierungen + Frei-Text
    const cartLines = items.map((i) => `${i.quantity}x ${i.name} (${i.price})`);
    if (aufbauKomplett && aufbauVerfuegbar) {
      cartLines.push(`+ Aufbau-Service (Komplettpaket, +${formatEur(aufbauSumme)})`);
    }
    if (lieferungGewuenscht) {
      cartLines.push(
        `+ Lieferung zum Event${distanceKm !== null ? ` (${billKm} km, ${formatEur(lieferpreis)})` : " (Preis im Angebot)"}`,
      );
    }
    if (abholungGewuenscht) {
      cartLines.push(
        `+ Abholung nach Event${distanceKm !== null ? ` (${billKm} km, ${formatEur(abholpreis)})` : " (Preis im Angebot)"}`,
      );
    }
    if (lieferAktiv && lieferStrasse) {
      cartLines.push(`Event-Adresse: ${lieferStrasse} ${lieferHausnr}, ${plz}`);
    }
    const cartText = cartLines.join("\n");
    const userNotiz = notiz.trim();
    const nachricht = userNotiz
      ? `${cartText}\n\n— Anmerkung des Kunden —\n${userNotiz}`
      : cartText;

    setSubmitting(true);
    setSubmitResult("idle");
    setErrorText("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vorname: vorname.trim(),
          nachname: nachname.trim(),
          email: email.trim(),
          telefon: telefon.trim() || undefined,
          adresse_plz: plz,
          adresse_strasse: lieferAktiv ? lieferStrasse.trim() : undefined,
          event_datum_von: rangeVon!,
          event_datum_bis: rangeBis!,
          nachricht,
          agb_akzeptiert: agreed,
          cart_items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
          aufbau_komplett: aufbauKomplett && aufbauVerfuegbar,
          lieferung_gewuenscht: lieferungGewuenscht,
          abholung_gewuenscht: abholungGewuenscht,
          liefer_strasse: lieferAktiv ? lieferStrasse.trim() : undefined,
          liefer_hausnr: lieferAktiv ? lieferHausnr.trim() : undefined,
          distance_km: distanceKm,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorText(data.error || `HTTP ${res.status}`);
        setSubmitResult("error");
      } else {
        setSubmitResult("success");
        setVorname("");
        setNachname("");
        setEmail("");
        setTelefon("");
        setPlz("");
        setNotiz("");
        setAgreed(false);
        clearCart();
        clearRange();
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Netzwerk-Fehler");
      setSubmitResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="container-width px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center text-gray-400">Warenkorb wird geladen …</div>
      </div>
    );
  }

  if (items.length === 0 && submitResult !== "success") {
    return (
      <section className="container-width px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-md mx-auto text-center glass-card p-8 md:p-10">
          <svg
            className="w-20 h-20 mx-auto text-gray-600 mb-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
            />
          </svg>
          <h1 className="font-display text-2xl font-bold text-white mb-2">
            Ihr Warenkorb ist leer.
          </h1>
          <p className="text-gray-400 mb-6">
            Wählen Sie Artikel aus unserem Sortiment, dann finden Sie sie hier zur Anfrage.
          </p>
          <Link
            href="/#sortiment"
            className="inline-block px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Sortiment ansehen
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-width px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <div className="mb-8">
        <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-2">
          Ihre Anfrage
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-white">
          Warenkorb &amp; Buchungs-Anfrage
        </h1>
        <p className="text-gray-400 mt-2">
          Prüfen Sie Ihre Auswahl, ergänzen Sie Ihre Kontaktdaten und senden Sie uns die unverbindliche Anfrage.
        </p>
      </div>

      {submitResult === "success" && (
        <div className="mb-8 p-5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-200">
          <p className="font-semibold mb-1">Vielen Dank! Ihre Anfrage ist bei uns eingegangen.</p>
          <p className="text-sm">
            Sie erhalten gleich eine Bestätigungs-Mail. Wir melden uns in der Regel innerhalb von 24 Stunden mit einem
            konkreten Angebot.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-gold-400 hover:text-gold-300 underline text-sm"
          >
            ← Zurück zur Startseite
          </Link>
        </div>
      )}

      {submitResult !== "success" && (
        <div className="grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-10">
          {/* Linke Spalte: Items + Zeitraum + Anmerkungen + Form */}
          <div className="space-y-6">
            {/* Mietzeitraum */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white text-lg">Mietzeitraum</h2>
                {hasRange && (
                  <button
                    type="button"
                    onClick={() => {
                      // Range erst clearen, dann Sheet oeffnen → User waehlt Start + Ende neu.
                      // Sonst: react-day-picker-Range-Mode setzt nur "nahesten" Endpunkt
                      // beim Klick, der Start ist nicht mehr erreichbar.
                      clearRange();
                      setDateSheetOpen(true);
                    }}
                    className="text-gold-400 text-sm hover:text-gold-300 underline"
                  >
                    Zeitraum neu wählen
                  </button>
                )}
              </div>
              {hasRange ? (
                <div className="text-white">
                  <div className="font-medium">
                    {formatGerman(rangeVon!)} – {formatGerman(rangeBis!)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {dauerTage} {dauerTage === 1 ? "Tag" : "Tage"}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                  <span className="text-amber-200 text-sm">
                    Bitte wählen Sie einen Mietzeitraum, um Preise zu kalkulieren.
                  </span>
                  <button
                    type="button"
                    onClick={() => setDateSheetOpen(true)}
                    className="text-amber-200 text-sm font-medium hover:text-amber-100 underline whitespace-nowrap"
                  >
                    Zeitraum wählen
                  </button>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="glass-card p-5">
              <h2 className="font-semibold text-white text-lg mb-4">
                Artikel ({totalItems})
              </h2>
              <ul className="space-y-3">
                {itemPricing.map(({ item, mietsumme, kaution, aufAnfrage }) => (
                  <li
                    key={item.name}
                    className="border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{item.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {aufAnfrage ? "Preis auf Anfrage" : `${item.price} pro Wochenende`}
                          {kaution !== null && kaution > 0 && !aufAnfrage && (
                            <span className="text-gray-500"> · {formatEur(kaution)} Kaution / Stück</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => removeItem(item.name)}
                          className="w-8 h-8 rounded-md border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all"
                          aria-label="Anzahl verringern"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="text-white font-semibold text-sm w-7 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addItem(item.name, item.price)}
                          className="w-8 h-8 rounded-md bg-gold-500 text-navy-900 flex items-center justify-center hover:bg-gold-400 transition-all"
                          aria-label="Anzahl erhöhen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => updateQuantity(item.name, 0)}
                          className="ml-1 w-8 h-8 rounded-md text-gray-400 hover:text-red-300 hover:bg-red-500/10 inline-flex items-center justify-center transition-all"
                          aria-label="Artikel entfernen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Sub-total */}
                    {mietsumme !== null && (
                      <div className="mt-1.5 text-right text-sm text-gold-400 font-medium">
                        {formatEur(mietsumme)}
                      </div>
                    )}
                    {aufAnfrage && (
                      <div className="mt-1.5 text-right text-sm text-gray-400 italic">
                        Auf Anfrage
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <Link
                  href="/#sortiment"
                  className="text-gold-400 text-sm hover:text-gold-300 underline"
                >
                  + Weitere Artikel hinzufügen
                </Link>
              </div>

              {/* Aufbau-Komplettpaket-Toggle (nur wenn mind. ein Item Aufbau-Pauschale hat) */}
              {aufbauVerfuegbar && (
                <label className="mt-5 flex items-start gap-3 cursor-pointer p-4 rounded-lg bg-white/5 border border-white/10 hover:border-gold-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={aufbauKomplett}
                    onChange={(e) => setAufbauKomplett(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500/50 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">
                      Aufbau-Service hinzubuchen (<span className="text-gold-400">+ {formatEur(aufbauSumme)}</span>)
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      Wir bauen alle Artikel vor Ort für Sie auf. Pauschale für die gesamte Bestellung,
                      keine extra Berechnung pro Artikel.
                    </p>
                  </div>
                </label>
              )}

              {zeigeAufbauHelfer && (
                <p className="mt-2 flex items-start gap-2 text-amber-300/90 text-xs leading-relaxed px-1">
                  <span aria-hidden>⚠️</span>
                  <span>{AUFBAU_HELFER_HINWEIS}</span>
                </p>
              )}

              {/* Lieferung + Abholung */}
              <div className="mt-5 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg bg-white/5 border border-white/10 hover:border-gold-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={lieferungGewuenscht}
                    onChange={(e) => setLieferungGewuenscht(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500/50 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">
                      Lieferung zum Event
                      {distanceKm !== null && lieferungGewuenscht && (
                        <span className="text-gold-400"> (+ {formatEur(lieferpreis)})</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      Wir bringen die Artikel zu Ihrer Event-Adresse. 2 € pro Kilometer (einfache Strecke).
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg bg-white/5 border border-white/10 hover:border-gold-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={abholungGewuenscht}
                    onChange={(e) => setAbholungGewuenscht(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500/50 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm">
                      Abholung nach Event
                      {distanceKm !== null && abholungGewuenscht && (
                        <span className="text-gold-400"> (+ {formatEur(abholpreis)})</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      Wir holen die Artikel nach Ihrem Event wieder ab. 2 € pro Kilometer (einfache Strecke).
                    </p>
                  </div>
                </label>

                {/* Liefer-Adress-Felder (sichtbar wenn eines der beiden aktiv) */}
                {lieferAktiv && (
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                    <div className="text-sm text-gray-300 font-medium">Event-Adresse</div>
                    <div className="grid grid-cols-[1fr_120px] gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Straße *</label>
                        <input
                          type="text"
                          value={lieferStrasse}
                          onChange={(e) => setLieferAdresse(e.target.value, lieferHausnr)}
                          placeholder="z.B. Musterstraße"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Hausnr. *</label>
                        <input
                          type="text"
                          value={lieferHausnr}
                          onChange={(e) => setLieferAdresse(lieferStrasse, e.target.value)}
                          placeholder="42a"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      PLZ erfassen wir weiter unten im Kontakt-Formular. Wir berechnen die Strecke automatisch.
                    </p>

                    {distanceLoading && (
                      <p className="text-xs text-gray-400">Strecke wird berechnet …</p>
                    )}
                    {distanceKm !== null && !distanceLoading && (
                      <p className="text-xs text-gold-400">
                        Strecke: {distanceKm.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km
                        (einfache Strecke ab Alsbach-Hähnlein)
                      </p>
                    )}
                    {distanceError && !distanceLoading && (
                      <p className="text-xs text-amber-300">
                        {distanceError}. Wir berechnen den Liefer-Preis manuell im Angebot.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Kontaktdaten + Anmerkungen */}
            <form onSubmit={handleSubmit} className="glass-card p-5 space-y-5">
              <h2 className="font-semibold text-white text-lg">Ihre Kontaktdaten</h2>

              {submitResult === "error" && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  Es gab ein Problem beim Senden Ihrer Anfrage{errorText ? `: ${errorText}` : "."} Bitte versuchen Sie es in Kürze erneut.
                </div>
              )}

              {/* Honeypot */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Website (bitte freilassen)
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Vorname *</label>
                  <input
                    type="text"
                    required
                    autoComplete="given-name"
                    value={vorname}
                    onChange={(e) => setVorname(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Nachname *</label>
                  <input
                    type="text"
                    required
                    autoComplete="family-name"
                    value={nachname}
                    onChange={(e) => setNachname(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">E-Mail *</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Handy <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="z.B. 0151 23456789"
                    value={telefon}
                    onChange={(e) => setTelefon(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">PLZ *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4,5}"
                  maxLength={5}
                  required
                  autoComplete="postal-code"
                  placeholder="z.B. 64665"
                  value={plz}
                  onChange={(e) => setPlz(e.target.value)}
                  className="w-32 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Für die Liefer-Pauschale im Angebot. Bei Selbstabholung einfach Ihre Wohn-PLZ.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Anmerkungen <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  placeholder="z.B. Lieferung gewünscht, Adresse vor Ort, besondere Wünsche, Selbstabholung …"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all resize-none"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500/50"
                  required
                />
                <span className="text-sm text-gray-400">
                  Ich gebe hiermit meine Zustimmung zu den{" "}
                  <a href="/agbs" className="text-gold-400 hover:text-gold-500 underline">
                    AGB
                  </a>{" "}
                  und der{" "}
                  <a href="/datenschutz" className="text-gold-400 hover:text-gold-500 underline">
                    Datenschutzerklärung
                  </a>
                  .
                </span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {submitting && (
                    <svg
                      className="animate-spin h-5 w-5 text-navy-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  <span>{submitting ? "Wird gesendet …" : "Unverbindlich anfragen"}</span>
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Wir bestätigen Verfügbarkeit per Mail. Keine Zahlung jetzt. Antwort in der Regel innerhalb 24 Stunden.
                </p>
              </div>
            </form>
          </div>

          {/* Rechte Spalte: Preis-Breakdown (Sticky) */}
          <aside className="lg:sticky lg:top-28 self-start">
            <div className="glass-card p-5">
              <h2 className="font-semibold text-white text-lg mb-4">Preis-Übersicht</h2>

              {!hasRange && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  Bitte Mietzeitraum wählen, um den Gesamtpreis zu berechnen.
                </div>
              )}

              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-gray-400">Mietpreis (Wochenende)</dt>
                  <dd className="text-white font-medium">{formatEur(totalMiete)}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-gray-400">Kaution (rückerstattbar)</dt>
                  <dd className="text-white font-medium">{formatEur(totalKaution)}</dd>
                </div>
                {totalAufbau > 0 && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-gray-400">Aufbau-Pauschale</dt>
                    <dd className="text-white font-medium">{formatEur(totalAufbau)}</dd>
                  </div>
                )}
                {lieferpreis > 0 && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-gray-400">Lieferung ({billKm} km)</dt>
                    <dd className="text-white font-medium">{formatEur(lieferpreis)}</dd>
                  </div>
                )}
                {abholpreis > 0 && (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-gray-400">Abholung ({billKm} km)</dt>
                    <dd className="text-white font-medium">{formatEur(abholpreis)}</dd>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 mt-2 flex items-baseline justify-between">
                  <dt className="text-white font-semibold">Voraussichtlich gesamt</dt>
                  <dd className="text-gold-400 font-bold text-lg">{formatEur(totalGesamt)}</dd>
                </div>
                {totalKaution > 0 && (
                  <p className="text-xs text-gray-500 leading-relaxed pt-1">
                    Davon Kaution {formatEur(totalKaution)}: wird bei der Übergabe als Stripe-Vorautorisierung auf deiner Karte vorgemerkt (es wird nichts abgebucht) und nach schadenfreier Rückgabe automatisch wieder freigegeben.
                  </p>
                )}
                {aufAnfrageCount > 0 && (
                  <p className="text-xs text-gray-500 leading-relaxed pt-1">
                    + {aufAnfrageCount} Artikel auf Anfrage. Preis dafür kommt im Angebot dazu.
                  </p>
                )}
                {!productsLoaded && (
                  <p className="text-xs text-gray-600 italic pt-1">Preise werden geladen …</p>
                )}
              </dl>

              <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  Unverbindlich. Keine Zahlung jetzt.
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Antwort innerhalb 24h.
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  Preise als Schätzung. Verbindlich im Angebot.
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {dateSheetOpen && (
        <DateRangeSheet open={dateSheetOpen} onClose={() => setDateSheetOpen(false)} />
      )}
    </section>
  );
}
