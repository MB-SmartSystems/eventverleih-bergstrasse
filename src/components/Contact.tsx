"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCart } from "./CartContext";

const MAX_RANGE_DAYS = 5;

// Akzeptiert TT.MM.JJJJ ODER TT.MM.JJ und konvertiert zu YYYY-MM-DD.
// Returns null wenn nicht parsbar.
function parseGermanDate(input: string): string | null {
  const s = input.trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function Contact() {
  const [agreed, setAgreed] = useState(false);
  const { items, cartSummaryText, totalItems, clearCart } = useCart();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"idle" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [vonInput, setVonInput] = useState("");
  const [bisInput, setBisInput] = useState("");

  const todayPlus1Str = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    if (totalItems > 0) {
      setMessage(cartSummaryText());
    }
  }, [items, totalItems, cartSummaryText]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    // Form-Reference VOR await speichern — e.currentTarget ist nach await null (React-Event-Pooling)
    const form = e.currentTarget;
    const fd = new FormData(form);

    if (!vonInput.trim() || !bisInput.trim()) {
      setErrorText("Mietzeitraum (von und bis) ist Pflicht.");
      setSubmitResult("error");
      return;
    }
    const eventVon = parseGermanDate(vonInput);
    const eventBis = parseGermanDate(bisInput);
    if (!eventVon) {
      setErrorText("Von-Datum bitte im Format TT.MM.JJJJ (z.B. 20.06.2026).");
      setSubmitResult("error");
      return;
    }
    if (!eventBis) {
      setErrorText("Bis-Datum bitte im Format TT.MM.JJJJ (z.B. 22.06.2026).");
      setSubmitResult("error");
      return;
    }
    if (eventBis < eventVon) {
      setErrorText("Das Bis-Datum muss nach dem Von-Datum liegen.");
      setSubmitResult("error");
      return;
    }
    if (eventVon < todayPlus1Str) {
      setErrorText("Der Mietzeitraum muss mindestens ab morgen starten.");
      setSubmitResult("error");
      return;
    }
    const days = Math.round((new Date(eventBis).getTime() - new Date(eventVon).getTime()) / 86_400_000);
    if (days > MAX_RANGE_DAYS) {
      setErrorText(`Der Mietzeitraum darf maximal ${MAX_RANGE_DAYS} Tage betragen.`);
      setSubmitResult("error");
      return;
    }

    setSubmitting(true);
    setSubmitResult("idle");
    setErrorText("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vorname: String(fd.get("vorname") || ""),
          nachname: String(fd.get("nachname") || ""),
          email: String(fd.get("email") || ""),
          telefon: String(fd.get("telefon") || ""),
          adresse_strasse: String(fd.get("adresse_strasse") || ""),
          adresse_plz: String(fd.get("adresse_plz") || ""),
          adresse_ort: String(fd.get("adresse_ort") || ""),
          event_datum_von: eventVon,
          event_datum_bis: eventBis,
          nachricht: String(fd.get("nachricht") || ""),
          agb_akzeptiert: agreed,
          cart_items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorText(data.error || `HTTP ${res.status}`);
        setSubmitResult("error");
      } else {
        setSubmitResult("success");
        form.reset();
        setAgreed(false);
        setMessage("");
        setVonInput("");
        setBisInput("");
        clearCart();
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Netzwerk-Fehler");
      setSubmitResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="kontakt" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left: Info */}
          <div>
            <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
              Kontakt & Anfrage
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
              Lassen Sie uns Ihr Fest planen
            </h2>
            <p className="text-gray-400 leading-relaxed mb-10">
              Sie möchten Zelte oder Eventausstattung für Ihre Feier mieten?
              Senden Sie uns Ihre Anfrage — wir melden uns schnell mit
              Verfügbarkeit und einem klaren Angebot.
            </p>

            {/* Contact Methods */}
            <div className="space-y-4 mb-10">
              <a
                href="https://wa.me/4915679521124"
                className="flex items-center gap-4 glass-card p-4 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-gold-400 transition-colors">
                    WhatsApp
                  </div>
                  <div className="text-gray-400 text-sm">
                    +49 156 79521124
                  </div>
                </div>
              </a>

              <a
                href="tel:+4915679521124"
                className="flex items-center gap-4 glass-card p-4 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-gold-400 transition-colors">
                    Telefon
                  </div>
                  <div className="text-gray-400 text-sm">
                    +49 156 79521124
                  </div>
                </div>
              </a>

              <a
                href="mailto:info@eventverleih-bergstrasse.de"
                className="flex items-center gap-4 glass-card p-4 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-gold-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-gold-400 transition-colors">
                    E-Mail
                  </div>
                  <div className="text-gray-400 text-sm">
                    info@eventverleih-bergstrasse.de
                  </div>
                </div>
              </a>
            </div>

            {/* Hero Image */}
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden hidden lg:block">
              <Image
                src="/images/gallery/partyzelt-lange-tafel-stuehle-nacht.jpg"
                alt="Beleuchtetes Partyzelt bei Nacht"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Right: Form */}
          <div className="glass-card p-6 md:p-8">
            <h3 className="font-display text-xl font-semibold mb-6">
              Anfrage senden
            </h3>

            {submitResult === "success" && (
              <div className="mb-5 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
                Vielen Dank! Ihre Anfrage ist bei uns eingegangen. Sie erhalten gleich eine Bestätigungsmail und ich
                melde mich in der Regel innerhalb von 24 Stunden mit einem konkreten Angebot.
              </div>
            )}
            {submitResult === "error" && (
              <div className="mb-5 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                Es gab ein Problem beim Senden Ihrer Anfrage{errorText ? `: ${errorText}` : "."} Bitte versuchen Sie es
                erneut oder schreiben Sie direkt an{" "}
                <a href="mailto:info@eventverleih-bergstrasse.de" className="underline">
                  info@eventverleih-bergstrasse.de
                </a>
                .
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Vorname
                  </label>
                  <input
                    type="text"
                    name="vorname"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Nachname
                  </label>
                  <input
                    type="text"
                    name="nachname"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Telefonnummer
                </label>
                <input
                  type="tel"
                  name="telefon"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  E-Mail-Adresse
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                />
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="text-xs text-gray-500 mb-3">
                  Anschrift (für Rechnung — kann auch später nachgereicht werden)
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Straße + Hausnummer
                  </label>
                  <input
                    type="text"
                    name="adresse_strasse"
                    autoComplete="street-address"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">PLZ</label>
                    <input
                      type="text"
                      name="adresse_plz"
                      inputMode="numeric"
                      pattern="[0-9]{4,5}"
                      maxLength={5}
                      autoComplete="postal-code"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-400 mb-1.5">Ort</label>
                    <input
                      type="text"
                      name="adresse_ort"
                      autoComplete="address-level2"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="text-sm text-gray-300 mb-3">
                  Mietzeitraum <span className="text-gold-400">*</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Liefer- und Rückgabetag im Format TT.MM.JJJJ. Maximal {MAX_RANGE_DAYS} Tage.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Von</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="z.B. 20.06.2026"
                      value={vonInput}
                      onChange={(e) => setVonInput(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Bis</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="z.B. 22.06.2026"
                      value={bisInput}
                      onChange={(e) => setBisInput(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Gewünschte Artikel oder Personenanzahl
                  {totalItems > 0 && (
                    <span className="text-gold-400 ml-1">
                      ({totalItems} Artikel ausgewählt)
                    </span>
                  )}
                </label>
                <textarea
                  name="nachricht"
                  rows={4}
                  required
                  minLength={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="z.B. 1x Faltzelt 3×6m, 4x Tische, 24x Stühle... oder wählen Sie oben Artikel aus."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all resize-none"
                />
                <div className="text-xs text-gray-500 mt-2">
                  Standard ist Selbstabholung am Lager in Alsbach-Hähnlein.
                  Falls Lieferung oder Aufbau gewünscht — bitte hier kurz erwähnen,
                  den Preis klären wir im Angebot.
                </div>
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
                  <a
                    href="/agbs"
                    className="text-gold-400 hover:text-gold-500 underline"
                  >
                    AGB
                  </a>{" "}
                  und der{" "}
                  <a
                    href="/datenschutz"
                    className="text-gold-400 hover:text-gold-500 underline"
                  >
                    Datenschutzerklärung
                  </a>
                  .
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                disabled={!agreed || submitting}
              >
                {submitting && (
                  <svg
                    className="animate-spin h-5 w-5 text-navy-900"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                <span>{submitting ? "Wird gesendet …" : "Anfrage absenden"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
