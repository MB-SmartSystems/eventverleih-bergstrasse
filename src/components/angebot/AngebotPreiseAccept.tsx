"use client";

/**
 * AngebotPreiseAccept — Client-Block fuer Preise + Hinweise + Confirm.
 *
 * Modi:
 *  - "customer"        → Toggles fuer Lieferung/Abholung/Aufbau (nur abwaehlbar),
 *                        live Anzahlungs-Recalc, AcceptForm sendet decline_* mit.
 *  - "admin-preview"   → Statische Preise (keine Toggles), Platzhalter statt AcceptForm.
 *
 * State-Logik:
 *  - includeLieferung/Abholung/Aufbau initialisiert aus Server-Props (true wenn Preis > 0).
 *  - Abwaehlbar, nicht zu-waehlbar (Kunde kann nur reduzieren).
 *  - Effektive Anzahlung/Restzahlung wird client-seitig berechnet, Kaution bleibt fix.
 */
import { useState } from "react";
import AcceptForm from "@/app/angebot/[token]/AcceptForm";

interface KundeForAccept {
  Vorname: string;
  Nachname: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
}

export interface AngebotPreiseAcceptProps {
  mode: "customer" | "admin-preview";
  token: string;
  statusVal: string;
  hasPrices: boolean;
  hasUpdateBanner: boolean;
  displayPositions: Array<{
    id: number;
    bezeichnung: string;
    anzahl: number;
    einzelpreis: number;
    gesamt: number;
  }>;
  preisArtikel: string;
  preisLieferung: string;
  preisAbholung: string;
  preisAufbau: string;
  anzahlungSoll: string;
  restzahlungSoll: string;
  kautionSoll: string;
  akzeptiertAm: string | null;
  anzahlungBezahltAm: string | null;
  stripeAnzahlungLink: string | null;
  stripeKomplettzahlungLink: string | null;
  preisArtikelLive: string;
  preisLieferungLive: string;
  preisAbholungLive: string;
  preisAufbauLive: string;
  kundeForAccept: KundeForAccept;
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function fmtEurStr(v: string | null): string {
  if (!v) return "0,00 €";
  return fmtEur(parseFloat(v));
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

export default function AngebotPreiseAccept(props: AngebotPreiseAcceptProps) {
  const {
    mode,
    token,
    statusVal,
    hasPrices,
    hasUpdateBanner,
    displayPositions,
    preisArtikel,
    preisLieferung,
    preisAbholung,
    preisAufbau,
    anzahlungSoll,
    restzahlungSoll,
    kautionSoll,
    akzeptiertAm,
    anzahlungBezahltAm,
    stripeAnzahlungLink,
    stripeKomplettzahlungLink,
    preisArtikelLive,
    preisLieferungLive,
    preisAbholungLive,
    preisAufbauLive,
    kundeForAccept,
  } = props;

  const isPreview = mode === "admin-preview";
  // Toggles nur im Customer-Modus pre-Akzept aktiv. Im Preview-/Akzept-Modus eingefroren.
  const togglesActive = mode === "customer" && (statusVal !== "Akzeptiert" || hasUpdateBanner);

  // Initial-State: alle aktiv wenn Preis > 0
  const lieferungAvailable = num(preisLieferung) > 0;
  const abholungAvailable = num(preisAbholung) > 0;
  const aufbauAvailable = num(preisAufbau) > 0;
  const [includeLieferung, setIncludeLieferung] = useState(lieferungAvailable);
  const [includeAbholung, setIncludeAbholung] = useState(abholungAvailable);
  const [includeAufbau, setIncludeAufbau] = useState(aufbauAvailable);

  // Effektive Werte je nach Toggle-State (im Preview-/Akzept-Modus = Original-Werte)
  const effLieferung = togglesActive ? (includeLieferung ? num(preisLieferung) : 0) : num(preisLieferung);
  const effAbholung = togglesActive ? (includeAbholung ? num(preisAbholung) : 0) : num(preisAbholung);
  const effAufbau = togglesActive ? (includeAufbau ? num(preisAufbau) : 0) : num(preisAufbau);

  const effSumme = num(preisArtikel) + effLieferung + effAbholung + effAufbau;
  const effAnzahlung = togglesActive
    ? Math.round(effSumme * 0.3 * 100) / 100
    : num(anzahlungSoll);
  const effRestzahlung = togglesActive
    ? Math.round((effSumme - effAnzahlung) * 100) / 100
    : num(restzahlungSoll);

  // Leistungsumfang-Text dynamisch
  const hasLieferung = effLieferung > 0;
  const hasAbholung = effAbholung > 0;
  const hasAufbau = effAufbau > 0;
  const hasAnyLogistik = hasLieferung || hasAbholung;

  // Decline-Flags fuer Accept-Submit
  const declineFlags = togglesActive
    ? {
        lieferung: lieferungAvailable && !includeLieferung,
        abholung: abholungAvailable && !includeAbholung,
        aufbau: aufbauAvailable && !includeAufbau,
      }
    : undefined;

  // === RENDER ===

  return (
    <>
      {/* Preisuebersicht */}
      <h2 className="text-xl font-semibold text-white mt-8">Preisübersicht</h2>
      {!hasPrices ? (
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
          <p>
            Manuel meldet sich in Kürze mit dem konkreten Angebot, sobald die Verfügbarkeit für Ihre Wunsch-Artikel
            geprüft ist. Die Preisübersicht erscheint dann automatisch hier auf dieser Seite.
          </p>
          <p className="text-[11px] text-gray-500 mt-3">
            Eventverleih Bergstraße ist Kleinunternehmer nach § 19 Abs. 1 UStG — kein USt-Ausweis.
          </p>
        </div>
      ) : (
        <>
          {displayPositions.length > 0 && (
            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-white/20">
                  <th className="py-2">Position</th>
                  <th className="py-2 text-right w-20">Anzahl</th>
                  <th className="py-2 text-right w-28">Einzelpreis</th>
                  <th className="py-2 text-right w-28">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {displayPositions.map((p) => (
                  <tr key={p.id} className="border-b border-white/10">
                    <td className="py-2">{p.bezeichnung}</td>
                    <td className="py-2 text-right">{p.anzahl}</td>
                    <td className="py-2 text-right">{`${p.einzelpreis.toFixed(2).replace(".", ",")} €`}</td>
                    <td className="py-2 text-right">{`${p.gesamt.toFixed(2).replace(".", ",")} €`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b border-white/10">
                <td className="py-2 font-medium">Mietsumme</td>
                <td className="py-2 text-right font-medium">{fmtEurStr(preisArtikel)}</td>
              </tr>
              {lieferungAvailable && (
                <ServiceRow
                  label="Lieferung"
                  preisStr={preisLieferung}
                  active={includeLieferung}
                  toggleable={togglesActive}
                  onToggle={() => setIncludeLieferung((v) => !v)}
                />
              )}
              {abholungAvailable && (
                <ServiceRow
                  label="Abholung"
                  preisStr={preisAbholung}
                  active={includeAbholung}
                  toggleable={togglesActive}
                  onToggle={() => setIncludeAbholung((v) => !v)}
                />
              )}
              {aufbauAvailable && (
                <ServiceRow
                  label="Aufbau-Service"
                  preisStr={preisAufbau}
                  active={includeAufbau}
                  toggleable={togglesActive}
                  onToggle={() => setIncludeAufbau((v) => !v)}
                />
              )}
              <tr className="border-b-2 border-gold-500/30 font-semibold">
                <td className="py-3">Anzahlung bei Bestätigung (30 %)</td>
                <td className="py-3 text-right">{fmtEur(effAnzahlung)}</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-2">Restzahlung bei Übergabe (70 %)</td>
                <td className="py-2 text-right">{fmtEur(effRestzahlung)}</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-2">Kaution (wird nach Rückgabe vollständig erstattet)</td>
                <td className="py-2 text-right">{fmtEurStr(kautionSoll)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-gray-500 mt-2">
            Alle Preise inkl. gesetzlicher Steuern. Eventverleih Bergstraße ist Kleinunternehmer nach § 19 Abs. 1
            UStG — kein USt-Ausweis.
          </p>
        </>
      )}

      {/* Wichtige Hinweise — zusammengefasste Gruppe */}
      {hasPrices && (statusVal !== "Akzeptiert" || hasUpdateBanner) && (
        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/10">
          {/* Reservierung */}
          <div className="p-4">
            <p className="text-gold-300 text-sm font-semibold mb-1">Reservierung</p>
            <p className="text-sm text-gray-300">
              Mit Ihrer Bestätigung wird der Termin <strong>vorgemerkt</strong>. <strong>Verbindlich reserviert</strong>{" "}
              ist er, sobald Ihre Anzahlung von <strong>{fmtEur(effAnzahlung)}</strong> eingegangen ist (innerhalb 7 Tagen).
            </p>
          </div>

          {/* Leistungsumfang */}
          <div className="p-4">
            <p className="text-white text-sm font-semibold mb-1">Leistungsumfang</p>
            {!hasAnyLogistik ? (
              <p className="text-sm text-gray-400">
                Abholung am Treffpunkt <strong>Grillhütte Sandwiese (Freizeitanlage), Alsbach-Hähnlein</strong> — Termin
                sprechen wir telefonisch ab. Lieferung und Aufbau gegen Aufpreis möglich.
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                {hasLieferung && hasAbholung
                  ? `Wir liefern an Ihre Adresse${hasAufbau ? " und bauen vor Ort auf" : ""} und holen die Artikel nach dem Event wieder ab.`
                  : hasLieferung
                    ? `Wir liefern an Ihre Adresse${hasAufbau ? " und bauen vor Ort auf" : ""}. Rückgabe durch Sie am Treffpunkt Grillhütte Sandwiese, Alsbach-Hähnlein.`
                    : `Selbstanlieferung am Treffpunkt Grillhütte Sandwiese, Alsbach-Hähnlein. Wir holen die Artikel nach dem Event bei Ihnen ab${hasAufbau ? " und bauen sie davor auf" : ""}.`}
              </p>
            )}
          </div>

          {/* Mietbedingungen */}
          <div className="p-4">
            <p className="text-white text-sm font-semibold mb-1">Mietbedingungen</p>
            <p className="text-sm text-gray-400">
              Mit der Bestätigung akzeptieren Sie unsere{" "}
              <a href="/agbs" className="text-gold-400 hover:text-gold-500 underline" target="_blank">
                AGB
              </a>{" "}
              und{" "}
              <a href="/datenschutz" className="text-gold-400 hover:text-gold-500 underline" target="_blank">
                Datenschutzerklärung
              </a>
              . Vollständige Vertragsklauseln (Aufbau, Lieferung, Rückgabe, Haftung):{" "}
              <a href={`/vertrag/${token}`} className="text-gold-400 hover:text-gold-500 underline" target="_blank">
                Mietvertrag
              </a>
              .
            </p>
          </div>
        </section>
      )}

      {/* Bestaetigungs-/Zahlungs-Block */}
      {isPreview ? (
        <div className="mt-10 p-6 rounded-xl bg-white/5 border border-dashed border-white/20 text-sm text-gray-400">
          <p className="font-semibold text-gray-300">ⓘ Platzhalter: Bestätigungs-/Zahlungs-Bereich</p>
          <p className="mt-2">
            An dieser Stelle sieht der Kunde — je nach Status — das Bestätigungs-Formular (AcceptForm),
            einen „Angebot bereits bestätigt"-Hinweis oder die Stripe-Zahlungs-Buttons. In der Vorschau
            sind diese Elemente bewusst ausgeblendet, damit keine versehentliche Akzeptanz oder Zahlung ausgelöst wird.
          </p>
        </div>
      ) : statusVal === "Akzeptiert" && !hasUpdateBanner ? (
        <div className="mt-10 space-y-4">
          <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="text-green-300 font-semibold">
              ✓ Dieses Angebot wurde von Ihnen am {fmtDate(akzeptiertAm)} bestätigt.
            </p>
            {anzahlungBezahltAm ? (
              <p className="text-sm text-gray-300 mt-2">
                Anzahlung am {fmtDate(anzahlungBezahltAm)} eingegangen — die Reservierung ist jetzt verbindlich.
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-2">
                Verbindlich wird die Reservierung erst mit Eingang Ihrer Anzahlung. Bitte wählen Sie unten Ihre
                Zahlungs-Option.
              </p>
            )}
          </div>

          {!anzahlungBezahltAm && (stripeAnzahlungLink || stripeKomplettzahlungLink) && (
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="text-white font-semibold text-lg">Jetzt online bezahlen</p>
              <p className="text-sm text-gray-400">
                Sicher per Karte, Klarna oder SOFORT — Ihre Reservierung ist sofort verbindlich.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {stripeAnzahlungLink && (
                  <a
                    href={stripeAnzahlungLink}
                    className="block px-4 py-4 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold text-center hover:from-gold-400 hover:to-gold-500 transition-all"
                  >
                    <div className="text-sm uppercase tracking-wider opacity-80">Anzahlung 30 %</div>
                    <div className="text-xl mt-1">{fmtEurStr(anzahlungSoll)}</div>
                  </a>
                )}
                {stripeKomplettzahlungLink && (
                  <a
                    href={stripeKomplettzahlungLink}
                    className="block px-4 py-4 rounded-lg border border-gold-500/30 text-gold-300 font-semibold text-center hover:bg-gold-500/10 transition-all"
                  >
                    <div className="text-sm uppercase tracking-wider opacity-80">Komplett bezahlen</div>
                    <div className="text-xl mt-1">
                      {fmtEur(
                        parseFloat(preisArtikelLive || "0") +
                          parseFloat(preisLieferungLive || "0") +
                          parseFloat(preisAbholungLive || "0") +
                          parseFloat(preisAufbauLive || "0"),
                      )}
                    </div>
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Alternativ Überweisung oder bar zur Übergabe. Ihre Buchung ist erst zu 100 % reserviert, sobald die
                Anzahlung bei uns eingegangen ist.
              </p>
            </div>
          )}
        </div>
      ) : !hasPrices ? (
        <div className="mt-10 p-6 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-blue-300 font-semibold">Ihre Anfrage wird gerade bearbeitet</p>
          <p className="text-sm text-gray-400 mt-2">
            Manuel sendet Ihnen das konkrete Angebot mit allen Preisen per E-Mail zu. Diese Seite aktualisiert sich
            dann automatisch, und Sie können die Reservierung mit einem Klick sichern.
          </p>
        </div>
      ) : (
        <AcceptForm
          token={token}
          kunde={{
            Vorname: kundeForAccept.Vorname ?? "",
            Nachname: kundeForAccept.Nachname ?? "",
            Email: kundeForAccept.Email ?? "",
            Telefon: kundeForAccept.Telefon ?? "",
            Adresse_Strasse: kundeForAccept.Adresse_Strasse ?? "",
            Adresse_PLZ: kundeForAccept.Adresse_PLZ ?? "",
            Adresse_Ort: kundeForAccept.Adresse_Ort ?? "",
          }}
          declineFlags={declineFlags}
        />
      )}
    </>
  );
}

interface ServiceRowProps {
  label: string;
  preisStr: string;
  active: boolean;
  toggleable: boolean;
  onToggle: () => void;
}

function ServiceRow({ label, preisStr, active, toggleable, onToggle }: ServiceRowProps) {
  return (
    <tr className="border-b border-white/10">
      <td className="py-2">
        <span className={active ? "" : "line-through text-gray-500"}>{label}</span>
        {toggleable && (
          <button
            type="button"
            onClick={onToggle}
            className={
              "ml-3 text-[11px] uppercase tracking-wider underline-offset-2 hover:underline " +
              (active ? "text-gray-500 hover:text-gray-300" : "text-gold-400 hover:text-gold-300")
            }
          >
            {active ? "abwählen" : "hinzufügen"}
          </button>
        )}
      </td>
      <td className={"py-2 text-right " + (active ? "" : "line-through text-gray-500")}>{fmtEurStr(preisStr)}</td>
    </tr>
  );
}
