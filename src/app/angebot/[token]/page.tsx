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
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadAngebot(token: string): Promise<{
  angebot: AngebotRow;
  buchung: BuchungRow;
  kunde: KundeRow;
} | null> {
  // Suche nach Token in Token_Public-Spalte
  const list = await listRows<AngebotRow>(TABLES.Angebote, { search: token, size: 5 });
  const angebot = list.results.find((a) => a.Token_Public === token);
  if (!angebot) return null;

  // Orphan-Angebote (ohne Buchung/Kunde) NICHT als gueltig rendern.
  // Lieber 404, damit Kunde nicht eine falsche "0 EUR-Buchung" sieht.
  if (!angebot.Buchung_Link?.[0]?.id || !angebot.Kunde_Link?.[0]?.id) {
    return null;
  }

  // Linked-Row-Fetches: bei Fehler nach oben durchreichen, NICHT swallowen
  const buchung = await getRow<BuchungRow>(TABLES.Buchungen, angebot.Buchung_Link[0].id);
  const kunde = await getRow<KundeRow>(TABLES.Kunden, angebot.Kunde_Link[0].id);

  return { angebot, buchung, kunde };
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
  const { angebot, buchung, kunde } = data;

  const anrede = `${kunde.Vorname} ${kunde.Nachname}`;
  const statusVal = angebot.Status?.value || "Offen";

  // Wenn keine Preise gesetzt sind, ist das ein Anfrage-Stadium — Preisuebersicht ausblenden
  const hasPrices = !!buchung.Preis_Artikel && parseFloat(buchung.Preis_Artikel) > 0;

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

            <h2 className="text-xl font-semibold text-white mt-8">Termin</h2>
            <p>
              {fmtDate(buchung.Event_datum_von)}
              {buchung.Event_datum_bis && buchung.Event_datum_bis !== buchung.Event_datum_von
                ? ` – ${fmtDate(buchung.Event_datum_bis)}`
                : ""}
            </p>

            {angebot.Anfragetext && (
              <>
                <h2 className="text-xl font-semibold text-white">Ihre Anfrage</h2>
                <p className="whitespace-pre-wrap text-gray-400">{angebot.Anfragetext}</p>
              </>
            )}

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
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    <tr className="border-b border-white/10">
                      <td className="py-2">Mietsumme der Artikel</td>
                      <td className="py-2 text-right">{fmtEur(buchung.Preis_Artikel)}</td>
                    </tr>
                    {buchung.Preis_Lieferung && parseFloat(buchung.Preis_Lieferung) > 0 && (
                      <tr className="border-b border-white/10">
                        <td className="py-2">Lieferung</td>
                        <td className="py-2 text-right">{fmtEur(buchung.Preis_Lieferung)}</td>
                      </tr>
                    )}
                    {buchung.Preis_Aufbau && parseFloat(buchung.Preis_Aufbau) > 0 && (
                      <tr className="border-b border-white/10">
                        <td className="py-2">Aufbau-Service</td>
                        <td className="py-2 text-right">{fmtEur(buchung.Preis_Aufbau)}</td>
                      </tr>
                    )}
                    <tr className="border-b-2 border-gold-500/30 font-semibold">
                      <td className="py-3">Anzahlung bei Bestätigung (30 %)</td>
                      <td className="py-3 text-right">{fmtEur(buchung.Anzahlung_Soll_Eur)}</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="py-2">Restzahlung bei Übergabe (70 %)</td>
                      <td className="py-2 text-right">{fmtEur(buchung.Restzahlung_Soll_Eur)}</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="py-2">Kaution (wird nach Rückgabe vollständig erstattet)</td>
                      <td className="py-2 text-right">{fmtEur(buchung.Kaution_Soll_Eur || buchung.Kaution)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-4">
                  Alle Preise inkl. gesetzlicher Steuern. Eventverleih Bergstraße ist Kleinunternehmer nach § 19 Abs. 1
                  UStG — kein USt-Ausweis.
                </p>
              </>
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
              an. Stornierung gemäß § 5 AGB (Mietsummen-basiert: 50 % bei 7 Tagen, 75 % bei 4 Tagen, 100 % bei 2 Tagen vor
              Veranstaltung).
            </p>

            {statusVal === "Akzeptiert" ? (
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
              <AcceptForm token={token} />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
