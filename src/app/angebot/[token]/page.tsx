/**
 * /angebot/[token] — Public-Token-basiertes Angebot
 *
 * Server-Side-Render: liest aus Baserow direkt mit DB-Token (server-only).
 * Token muss zu einer Angebot-Row matchen (Token_Public-Spalte).
 * Wenn Token ungueltig: 404.
 */
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";
import { parseSnapshot } from "@/lib/angebot-snapshot";
import AcceptForm from "./AcceptForm";

type AngebotRow = {
  id: number;
  Angebot_ID: number;
  Angebotsnummer: string;
  Status: { value: string } | null;
  Anfragetext: string | null;
  Anfragedatum: string | null;
  Angebotsdatum: string | null;
  Gueltig_bis: string | null;
  Gesamtpreis: string | null;
  Token_Public: string;
  Akzeptiert_am: string | null;
  Snapshot_JSON: string | null;
  Snapshot_Version: string | null;
  Akzept_Version: string | null;
  Buchung_Link: Array<{ id: number; value: string }>;
  Kunde_Link: Array<{ id: number; value: string }>;
};

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution: string | null;
  Gesamt: string | null;
  Anzahlung_Soll_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Kaution_Soll_Eur: string | null;
  Lieferadresse: string | null;
  Notizen: string | null;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};

type PositionRow = {
  id: number;
  Anzahl: string;
  Einzelpreis_Eur: string;
  Position_Gesamt_Eur: string;
  Artikel_Link: Array<{ id: number; value: string }>;
  Buchung_Link: Array<{ id: number }>;
};

type ArtikelRow = {
  id: number;
  Bezeichnung: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadAngebot(token: string): Promise<{
  angebot: AngebotRow;
  buchung: BuchungRow;
  kunde: KundeRow;
  positionen: Array<{ id: number; bezeichnung: string; anzahl: number; einzelpreis: number; gesamt: number }>;
} | null> {
  const list = await listRows<AngebotRow>(TABLES.Angebote, { search: token, size: 5 });
  const angebot = list.results.find((a) => a.Token_Public === token);
  if (!angebot) return null;
  if (!angebot.Buchung_Link?.[0]?.id || !angebot.Kunde_Link?.[0]?.id) return null;

  const buchungId = angebot.Buchung_Link[0].id;
  const [buchung, kunde, positionenAll, artikelAll] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, angebot.Kunde_Link[0].id),
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    listRows<ArtikelRow>(TABLES.Artikel, { size: 200 }),
  ]);
  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  const positionen = positionenAll.results
    .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
    .map((p) => {
      const aid = p.Artikel_Link?.[0]?.id;
      return {
        id: p.id,
        bezeichnung: aid ? artikelNameById.get(aid) ?? `Artikel ${aid}` : "—",
        anzahl: parseInt(p.Anzahl, 10) || 1,
        einzelpreis: parseFloat(p.Einzelpreis_Eur) || 0,
        gesamt: parseFloat(p.Position_Gesamt_Eur) || 0,
      };
    });

  return { angebot, buchung, kunde, positionen };
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtEur(v: string | null): string {
  if (!v) return "0,00 €";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function AngebotPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadAngebot(token);
  if (!data) notFound();
  const { angebot, buchung, kunde, positionen } = data;

  // Snapshot bevorzugen: nach "Angebot freigeben" friert die Kundenansicht ein,
  // bis Manuel ein Update versendet. Live-Daten nur als Fallback bei Pre-Versand.
  const snapshot = parseSnapshot(angebot.Snapshot_JSON);
  const snapshotVersion = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
  const akzeptVersion = parseInt(angebot.Akzept_Version ?? "0", 10) || 0;
  const hasUpdateBanner = snapshotVersion > 0 && akzeptVersion > 0 && snapshotVersion > akzeptVersion;

  const anrede = snapshot
    ? `${snapshot.kunde.vorname} ${snapshot.kunde.nachname}`
    : `${kunde.Vorname} ${kunde.Nachname}`;
  const statusVal = angebot.Status?.value || "Offen";

  // Anzeige-Preise aus Snapshot (eingefroren) oder Live
  const preisArtikel = snapshot ? snapshot.preis_artikel.toString() : (buchung.Preis_Artikel ?? "0");
  const preisLieferung = snapshot ? snapshot.preis_lieferung.toString() : (buchung.Preis_Lieferung ?? "0");
  const preisAufbau = snapshot ? snapshot.preis_aufbau.toString() : (buchung.Preis_Aufbau ?? "0");
  const anzahlungSoll = snapshot ? snapshot.anzahlung_soll_eur.toString() : (buchung.Anzahlung_Soll_Eur ?? "0");
  const restzahlungSoll = snapshot ? snapshot.restzahlung_soll_eur.toString() : (buchung.Restzahlung_Soll_Eur ?? "0");
  const kautionSoll = snapshot ? snapshot.kaution_soll_eur.toString() : (buchung.Kaution_Soll_Eur ?? buchung.Kaution ?? "0");
  const eventVon = snapshot ? snapshot.event_datum_von : buchung.Event_datum_von;
  const eventBis = snapshot ? snapshot.event_datum_bis : buchung.Event_datum_bis;
  const displayPositions = snapshot
    ? snapshot.positionen.map((p, i) => ({
        id: i,
        bezeichnung: p.bezeichnung,
        anzahl: p.anzahl,
        einzelpreis: p.einzelpreis,
        gesamt: p.gesamt,
      }))
    : positionen;

  const hasPrices = parseFloat(preisArtikel) > 0;

  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="container-width px-4 sm:px-6 lg:px-8 max-w-3xl">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Angebot {angebot.Angebotsnummer}
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

            {hasPrices && parseFloat(preisLieferung) === 0 && (
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-sm">
                <p className="text-white font-semibold">Leistungsumfang: Abholung an unserem Lager</p>
                <p className="text-gray-400 mt-1">
                  Die Artikel werden von Ihnen am vereinbarten Termin in
                  Alsbach-Hähnlein abgeholt und nach dem Event wieder zurückgebracht. Lieferung
                  und Aufbau sind gegen Aufpreis möglich — bitte melden Sie sich falls gewünscht.
                </p>
              </div>
            )}

            {hasPrices && parseFloat(preisLieferung) > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 text-sm">
                <p className="text-white font-semibold">Leistungsumfang: Lieferung{parseFloat(preisAufbau) > 0 ? " inkl. Aufbau" : ""}</p>
                <p className="text-gray-400 mt-1">
                  Wir liefern die Artikel zum vereinbarten Termin an Ihre Adresse{parseFloat(preisAufbau) > 0 ? " und bauen sie auf" : ""}.
                  Rückholung nach dem Event ist im Liefer-Preis enthalten.
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

            {statusVal === "Akzeptiert" && !hasUpdateBanner ? (
              <div className="mt-10 p-6 rounded-xl bg-green-500/10 border border-green-500/30">
                <p className="text-green-300 font-semibold">
                  ✓ Dieses Angebot wurde von Ihnen am{" "}
                  {fmtDate(angebot.Akzeptiert_am)} bestätigt.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Manuel meldet sich in Kürze mit der Anzahlungsaufforderung und den nächsten Schritten.
                </p>
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
                  Vorname: kunde.Vorname ?? "",
                  Nachname: kunde.Nachname ?? "",
                  Email: kunde.Email ?? "",
                  Telefon: kunde.Telefon ?? "",
                  Adresse_Strasse: kunde.Adresse_Strasse ?? "",
                  Adresse_PLZ: kunde.Adresse_PLZ ?? "",
                  Adresse_Ort: kunde.Adresse_Ort ?? "",
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
