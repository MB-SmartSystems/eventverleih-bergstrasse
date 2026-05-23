/**
 * AngebotView — gemeinsame Render-Komponente für die Kundenansicht (/angebot/[token])
 * und die Admin-Vorschau (/admin/angebot/[id]/preview).
 *
 * Reines Präsentations-Layer. Alle Anzeige-Werte kommen vorberechnet als Props rein.
 *
 * mode="customer"     → AcceptForm + Stripe-Zahlungs-Buttons aktiv.
 * mode="admin-preview"→ Preview-Banner oben, AcceptForm/Stripe durch Platzhalter ersetzt,
 *                       Update-Banner zeigt simulierten Versand-Stand.
 */
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcceptForm from "@/app/angebot/[token]/AcceptForm";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtEur(v: string | null): string {
  if (!v) return "0,00 €";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export interface AngebotViewProps {
  mode: "customer" | "admin-preview";
  token: string;
  angebotsnummer: string;
  anrede: string;
  statusVal: string;
  snapshotVersion: number;
  hasUpdateBanner: boolean;
  eventVon: string | null;
  eventBis: string | null;
  hasPrices: boolean;
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
  kundeForAccept: {
    Vorname: string;
    Nachname: string;
    Email: string;
    Telefon: string;
    Adresse_Strasse: string;
    Adresse_PLZ: string;
    Adresse_Ort: string;
  };
  previewVersion?: number;
}

export default function AngebotView(props: AngebotViewProps) {
  const {
    mode,
    token,
    angebotsnummer,
    anrede,
    statusVal,
    snapshotVersion,
    hasUpdateBanner,
    eventVon,
    eventBis,
    hasPrices,
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
    previewVersion,
  } = props;

  const isPreview = mode === "admin-preview";

  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="container-width px-4 sm:px-6 lg:px-8 max-w-3xl">
          {isPreview && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/15 border-2 border-red-400/60 text-red-100">
              <p className="font-bold text-base">
                ⚠️ Admin-Vorschau{previewVersion ? ` (v${previewVersion})` : ""} — diese Mail wurde noch <u>nicht</u> an den Kunden versendet.
              </p>
              <p className="text-sm text-red-200 mt-1">
                Was du hier siehst, würde der Kunde nach Klick auf „📧 Neue Version senden" angezeigt bekommen. Schließe diesen Tab, wenn die Ansicht passt — der Versand erfolgt erst über den Button auf der Anfragen-Seite.
              </p>
            </div>
          )}

          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Angebot {angebotsnummer}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
            Ihr Angebot von Eventverleih Bergstraße
          </h1>

          <div className="prose prose-invert max-w-none text-gray-300 space-y-6">
            <p>Hallo {anrede},</p>
            <p>vielen Dank für Ihre Anfrage. Hier finden Sie alle Details Ihres persönlichen Angebots.</p>

            {hasUpdateBanner && (
              <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-400/50 text-blue-200 text-sm">
                <p className="font-semibold mb-1">
                  Dieses Angebot wurde aktualisiert (Version {snapshotVersion}).
                </p>
                <p className="text-blue-300">
                  Bitte prüfen Sie die aktualisierten Details und bestätigen Sie das Angebot erneut, wenn alles passt.
                </p>
              </div>
            )}

            <h2 className="text-xl font-semibold text-white mt-8">Mietzeitraum</h2>
            <p>
              {fmtDate(eventVon)}
              {eventBis && eventBis !== eventVon ? ` – ${fmtDate(eventBis)}` : ""}
            </p>

            <h2 className="text-xl font-semibold text-white">Preisübersicht</h2>
            {!hasPrices ? (
              <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
                <p>
                  Manuel meldet sich in Kürze mit dem konkreten Angebot, sobald die Verfügbarkeit für Ihre Wunsch-Artikel
                  geprüft ist. Die Preisübersicht erscheint dann automatisch hier auf dieser Seite.
                </p>
                <p className="text-xs text-gray-500 mt-3">
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
                      <td className="py-2 text-right font-medium">{fmtEur(preisArtikel)}</td>
                    </tr>
                    {parseFloat(preisLieferung) > 0 && (
                      <tr className="border-b border-white/10">
                        <td className="py-2">Lieferung</td>
                        <td className="py-2 text-right">{fmtEur(preisLieferung)}</td>
                      </tr>
                    )}
                    {parseFloat(preisAbholung) > 0 && (
                      <tr className="border-b border-white/10">
                        <td className="py-2">Abholung</td>
                        <td className="py-2 text-right">{fmtEur(preisAbholung)}</td>
                      </tr>
                    )}
                    {parseFloat(preisAufbau) > 0 && (
                      <tr className="border-b border-white/10">
                        <td className="py-2">Aufbau-Service</td>
                        <td className="py-2 text-right">{fmtEur(preisAufbau)}</td>
                      </tr>
                    )}
                    <tr className="border-b-2 border-gold-500/30 font-semibold">
                      <td className="py-3">Anzahlung bei Bestätigung (30 %)</td>
                      <td className="py-3 text-right">{fmtEur(anzahlungSoll)}</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="py-2">Restzahlung bei Übergabe (70 %)</td>
                      <td className="py-2 text-right">{fmtEur(restzahlungSoll)}</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="py-2">Kaution (wird nach Rückgabe vollständig erstattet)</td>
                      <td className="py-2 text-right">{fmtEur(kautionSoll)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-4">
                  Alle Preise inkl. gesetzlicher Steuern. Eventverleih Bergstraße ist Kleinunternehmer nach § 19 Abs. 1
                  UStG — kein USt-Ausweis.
                </p>
              </>
            )}

            {hasPrices && (statusVal !== "Akzeptiert" || hasUpdateBanner) && (
              <div className="mt-6 p-4 rounded-lg bg-gold-500/10 border-l-4 border-gold-500 text-sm">
                <p className="text-gold-200 font-semibold">Wichtiger Hinweis zur Reservierung</p>
                <p className="text-gray-300 mt-1">
                  Mit Ihrer Bestätigung wird der Termin zunächst <strong>vorgemerkt</strong>. Die <strong>verbindliche Reservierung</strong> erfolgt erst
                  mit Eingang Ihrer Anzahlung von <strong>{fmtEur(anzahlungSoll)}</strong>. Bitte überweisen Sie diese innerhalb von 7 Tagen nach Bestätigung.
                </p>
              </div>
            )}

            {hasPrices && parseFloat(preisLieferung) === 0 && parseFloat(preisAbholung) === 0 && (
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-sm">
                <p className="text-white font-semibold">Leistungsumfang: Abholung am Treffpunkt</p>
                <p className="text-gray-400 mt-1">
                  Die Artikel werden von Ihnen am vereinbarten Termin am Treffpunkt{" "}
                  <strong>Grillhütte Sandwiese (Freizeitanlage), Alsbach-Hähnlein</strong>{" "}
                  abgeholt und nach dem Event ebenfalls dort zurückgebracht.
                  Den genauen Termin sprechen wir telefonisch mit Ihnen ab.
                  Lieferung und Aufbau sind gegen Aufpreis möglich — bitte melden Sie sich falls gewünscht.
                </p>
              </div>
            )}

            {hasPrices && (parseFloat(preisLieferung) > 0 || parseFloat(preisAbholung) > 0) && (
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-sm">
                <p className="text-white font-semibold">
                  Leistungsumfang:{" "}
                  {parseFloat(preisLieferung) > 0 && parseFloat(preisAbholung) > 0
                    ? "Lieferung und Abholung"
                    : parseFloat(preisLieferung) > 0
                      ? "Lieferung (Selbstrückgabe am Treffpunkt)"
                      : "Selbstanlieferung am Treffpunkt + Abholung durch uns"}
                  {parseFloat(preisAufbau) > 0 ? " inkl. Aufbau" : ""}
                </p>
                <p className="text-gray-400 mt-1">
                  {parseFloat(preisLieferung) > 0
                    ? `Wir liefern die Artikel zum vereinbarten Termin an Ihre Adresse${parseFloat(preisAufbau) > 0 ? " und bauen sie auf" : ""}.`
                    : `Sie übergeben die Artikel beim Treffpunkt Grillhütte Sandwiese (Freizeitanlage), Alsbach-Hähnlein.`}{" "}
                  {parseFloat(preisAbholung) > 0
                    ? "Wir holen die Artikel nach dem Event bei Ihnen ab."
                    : "Die Rückgabe erfolgt durch Sie selbst am Treffpunkt."}
                </p>
              </div>
            )}

            <h2 className="text-xl font-semibold text-white mt-8">Mietbedingungen</h2>
            <p>
              Mit Ihrer Bestätigung erkennen Sie unsere{" "}
              <a href="/agbs" className="text-gold-400 hover:text-gold-500 underline" target="_blank">
                AGB
              </a>{" "}
              und die{" "}
              <a href="/datenschutz" className="text-gold-400 hover:text-gold-500 underline" target="_blank">
                Datenschutzerklärung
              </a>{" "}
              an. Die vollständigen Mietbedingungen (Aufbau, Lieferung, Rückgabe, Haftung) finden Sie in Ihrem{" "}
              <a href={`/vertrag/${token}`} className="text-gold-400 hover:text-gold-500 underline" target="_blank">
                Mietvertrag
              </a>
              .
            </p>

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
                    ✓ Dieses Angebot wurde von Ihnen am{" "}
                    {fmtDate(akzeptiertAm)} bestätigt.
                  </p>
                  {anzahlungBezahltAm ? (
                    <p className="text-sm text-gray-300 mt-2">
                      Anzahlung am {fmtDate(anzahlungBezahltAm)} eingegangen — die Reservierung
                      ist jetzt verbindlich.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">
                      Verbindlich wird die Reservierung erst mit Eingang Ihrer Anzahlung.
                      Bitte wählen Sie unten Ihre Zahlungs-Option.
                    </p>
                  )}
                </div>

                {!anzahlungBezahltAm && (stripeAnzahlungLink || stripeKomplettzahlungLink) && (
                  <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <p className="text-white font-semibold text-lg">
                      Jetzt online bezahlen
                    </p>
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
                          <div className="text-xl mt-1">{fmtEur(anzahlungSoll)}</div>
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
                              (parseFloat(preisArtikelLive || "0") +
                                parseFloat(preisLieferungLive || "0") +
                                parseFloat(preisAbholungLive || "0") +
                                parseFloat(preisAufbauLive || "0"))
                                .toFixed(2)
                            )}
                          </div>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Alternativ können Sie auch per Überweisung oder bar zur Übergabe zahlen.
                      Bitte beachten Sie: Ihre Buchung ist erst zu 100 % reserviert, sobald die
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
              />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
