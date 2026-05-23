/**
 * /mein-bereich — Kunden-Dashboard
 *
 * Plan Phase 5 C2: zeigt alle Buchungen des eingeloggten Kunden,
 * Status in Kundensprache, Zahlungs-Stand + Stripe-Links bei Bedarf,
 * Mietzeitraum, Action-Buttons (Stornieren etc.).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentMember } from "@/lib/eventverleih/member-auth";
import { listAllRows, TABLES } from "@/lib/baserow/client";
import StornoButton from "./StornoButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BuchungRow {
  id: number;
  Buchung_ID: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Anzahlung_Soll_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Kaution_Soll_Eur: string | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Bezahlt_am: string | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Stripe_Anzahlung_Link: string | null;
  Stripe_Restzahlung_Link: string | null;
  Stripe_Komplettzahlung_Link: string | null;
  Token_Angebot: string | null;
  Kunde_Link: Array<{ id: number; value: string }>;
  Zahlungen_JSON: string | null;
}

const STATUS_LABEL_KUNDE: Record<string, { label: string; tone: string; hint: string }> = {
  Anfrage: { label: "Anfrage in Bearbeitung", tone: "bg-blue-500/10 text-blue-200 border-blue-500/30", hint: "Manuel meldet sich in Kürze mit dem konkreten Angebot." },
  Angebot_erstellt: { label: "Angebot in Vorbereitung", tone: "bg-blue-500/10 text-blue-200 border-blue-500/30", hint: "Das Angebot wird gerade fertiggestellt." },
  Angebot_versendet: { label: "Angebot wartet auf Ihre Bestätigung", tone: "bg-yellow-500/10 text-yellow-200 border-yellow-500/30", hint: "Bitte bestätigen Sie das Angebot über den Link in der E-Mail." },
  Bestaetigt: { label: "Bestätigt — Anzahlung steht aus", tone: "bg-amber-500/10 text-amber-200 border-amber-500/30", hint: "Die Reservierung ist verbindlich nach Eingang der Anzahlung." },
  Reserviert: { label: "Verbindlich reserviert", tone: "bg-green-500/10 text-green-200 border-green-500/30", hint: "Restzahlung wird ca. 14 Tage vor dem Event fällig." },
  Uebergeben: { label: "Artikel übergeben", tone: "bg-purple-500/10 text-purple-200 border-purple-500/30", hint: "Wir wünschen ein gelungenes Event!" },
  In_Miete: { label: "Aktuell in Miete", tone: "bg-purple-500/10 text-purple-200 border-purple-500/30", hint: "" },
  Zurueckgegeben: { label: "Zurückgegeben — Prüfung läuft", tone: "bg-cyan-500/10 text-cyan-200 border-cyan-500/30", hint: "Manuel prüft die Artikel in den nächsten 1-2 Werktagen und meldet sich zur Kaution." },
  Abgerechnet: { label: "Abgeschlossen", tone: "bg-gray-500/10 text-gray-200 border-gray-500/30", hint: "Vielen Dank für Ihre Buchung." },
  Storniert: { label: "Storniert", tone: "bg-red-500/10 text-red-200 border-red-500/30", hint: "" },
  No_Show: { label: "Nicht erschienen", tone: "bg-red-500/10 text-red-200 border-red-500/30", hint: "" },
};

function fmtEur(v: string | number | null): string {
  const n = v === null ? 0 : typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "0,00 €";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("de-DE");
}

export default async function MeinBereichPage() {
  const kunde = await getCurrentMember();
  if (!kunde) redirect("/mein-bereich/login");

  // Lade alle Buchungen + Rechnungen des Kunden
  const [buchungenAll, rechnungenAll] = await Promise.all([
    listAllRows<BuchungRow>(TABLES.Buchungen),
    listAllRows<{ id: number; Rechnungsnummer: string; Rechnungsdatum: string | null; Betrag_Gesamt: string | null; Token_Public: string; Kunde_Link: Array<{ id: number }> }>(TABLES.Rechnungen),
  ]);
  const meineBuchungen = buchungenAll.results.filter(
    (b) => b.Kunde_Link?.[0]?.id === kunde.id,
  );
  const meineRechnungen = rechnungenAll.results
    .filter((r) => r.Kunde_Link?.[0]?.id === kunde.id)
    .sort((a, b) => (b.Rechnungsdatum || "").localeCompare(a.Rechnungsdatum || ""));

  // Sortierung: aktuelle (Status nicht Abgerechnet/Storniert/No_Show) zuerst, sortiert nach Event-Datum
  const aktive = meineBuchungen.filter((b) => {
    const s = b.Status_Erweitert?.value || "";
    return !["Abgerechnet", "Storniert", "No_Show"].includes(s);
  }).sort((a, b) => (a.Event_datum_von || "").localeCompare(b.Event_datum_von || ""));

  const vergangene = meineBuchungen.filter((b) => {
    const s = b.Status_Erweitert?.value || "";
    return ["Abgerechnet", "Storniert", "No_Show"].includes(s);
  }).sort((a, b) => (b.Event_datum_von || "").localeCompare(a.Event_datum_von || ""));

  return (
    <main className="min-h-screen bg-navy-900 text-white py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-2">Mein Bereich</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              Hallo {kunde.Vorname || "—"} {kunde.Nachname || ""}
            </h1>
          </div>
          <form action="/mein-bereich/logout" method="POST">
            <button type="submit" className="text-sm text-gray-400 hover:text-white">
              Logout
            </button>
          </form>
        </div>

        {aktive.length === 0 && vergangene.length === 0 && (
          <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
            <p className="text-gray-400">Sie haben aktuell keine Buchungen.</p>
            <Link href="/#sortiment" className="inline-block mt-4 text-gold-400 hover:text-gold-500">
              Zum Sortiment ↗
            </Link>
          </div>
        )}

        {aktive.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Aktuelle Buchungen</h2>
            <div className="space-y-4">
              {aktive.map((b) => (
                <BuchungCard key={b.id} buchung={b} variant="aktiv" />
              ))}
            </div>
          </div>
        )}

        {vergangene.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Vergangene Buchungen</h2>
            <div className="space-y-3">
              {vergangene.map((b) => (
                <BuchungCard key={b.id} buchung={b} variant="archiv" />
              ))}
            </div>
          </div>
        )}

        {meineRechnungen.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Rechnungen</h2>
            <div className="space-y-2">
              {meineRechnungen.map((r) => (
                <Link
                  key={r.id}
                  href={`/rechnung/${r.Token_Public}`}
                  target="_blank"
                  className="block p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-gold-500/30 transition-all flex items-center gap-4"
                >
                  <div className="flex-1">
                    <div className="font-mono text-white">{r.Rechnungsnummer}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(r.Rechnungsdatum)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{fmtEur(r.Betrag_Gesamt)}</div>
                    <div className="text-xs text-gold-400 mt-0.5">Ansehen / drucken ↗</div>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Klick auf eine Rechnung öffnet die PDF-Ansicht. Über die Druck-Funktion Ihres Browsers
              (Strg+P / Cmd+P) können Sie sie als PDF speichern.
            </p>
          </div>
        )}

        <div className="mt-12 p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-500">
          Bei Fragen erreichen Sie uns per WhatsApp/Tel +49 156 79521124 oder
          per Mail an info@eventverleih-bergstrasse.de.
        </div>
      </div>
    </main>
  );
}

function BuchungCard({ buchung, variant }: { buchung: BuchungRow; variant: "aktiv" | "archiv" }) {
  const status = buchung.Status_Erweitert?.value || "Anfrage";
  const info = STATUS_LABEL_KUNDE[status] ?? { label: status, tone: "bg-gray-500/10 text-gray-200 border-gray-500/30", hint: "" };
  const zeitraum = `${fmtDate(buchung.Event_datum_von)} – ${fmtDate(buchung.Event_datum_bis)}`;
  const preisArtikel = parseFloat(buchung.Preis_Artikel || "0") || 0;
  const preisLieferung = parseFloat(buchung.Preis_Lieferung || "0") || 0;
  const preisAbholung = parseFloat(buchung.Preis_Abholung || "0") || 0;
  const preisAufbau = parseFloat(buchung.Preis_Aufbau || "0") || 0;
  const gesamt = preisArtikel + preisLieferung + preisAbholung + preisAufbau;

  // Zahlungen-Summe aus JSON
  let bezahlt = 0;
  try {
    if (buchung.Zahlungen_JSON) {
      const arr = JSON.parse(buchung.Zahlungen_JSON);
      if (Array.isArray(arr)) {
        bezahlt = arr
          .filter((z) => z.typ === "anzahlung" || z.typ === "restzahlung")
          .reduce((s, z) => s + (typeof z.betrag === "number" ? z.betrag : 0), 0);
      }
    }
  } catch { /* ignore */ }
  const offen = Math.max(0, gesamt - bezahlt);

  // Zahlung steht aus?
  const zahlungOffen = !buchung.Anzahlung_Bezahlt_am && (buchung.Stripe_Anzahlung_Link || buchung.Stripe_Komplettzahlung_Link);
  const restzahlungOffen = buchung.Anzahlung_Bezahlt_am && !buchung.Restzahlung_Bezahlt_am && offen > 0 && buchung.Stripe_Restzahlung_Link;

  return (
    <div className={`p-5 rounded-xl border ${variant === "aktiv" ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5"}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${info.tone} mb-2`}>
            {info.label}
          </div>
          <div className="text-lg font-semibold text-white">
            Buchung #{buchung.Buchung_ID || buchung.id}
          </div>
          <div className="text-sm text-gray-400 mt-1">{zeitraum}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Gesamt</div>
          <div className="text-lg font-semibold text-white">{fmtEur(gesamt)}</div>
        </div>
      </div>

      {info.hint && (
        <p className="text-sm text-gray-400 mb-3">{info.hint}</p>
      )}

      {variant === "aktiv" && (gesamt > 0) && (
        <div className="text-xs text-gray-400 grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-white/10">
          <div><div className="text-warm-muted">Gesamt</div><div className="text-white font-medium mt-0.5">{fmtEur(gesamt)}</div></div>
          <div><div className="text-warm-muted">Bezahlt</div><div className={`font-medium mt-0.5 ${bezahlt >= gesamt ? "text-green-300" : "text-white"}`}>{fmtEur(bezahlt)}</div></div>
          <div><div className="text-warm-muted">Offen</div><div className={`font-medium mt-0.5 ${offen === 0 ? "text-green-300" : "text-amber-300"}`}>{fmtEur(offen)}</div></div>
        </div>
      )}

      {/* Action-Buttons: Stripe-Links */}
      {variant === "aktiv" && (zahlungOffen || restzahlungOffen) && (
        <div className="flex flex-wrap gap-2">
          {zahlungOffen && buchung.Stripe_Anzahlung_Link && (
            <a href={buchung.Stripe_Anzahlung_Link} className="px-4 py-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all">
              Anzahlung zahlen ({fmtEur(buchung.Anzahlung_Soll_Eur)})
            </a>
          )}
          {zahlungOffen && buchung.Stripe_Komplettzahlung_Link && (
            <a href={buchung.Stripe_Komplettzahlung_Link} className="px-4 py-2 rounded-lg border border-gold-500/30 text-gold-300 text-sm font-semibold hover:bg-gold-500/10 transition-all">
              Komplett bezahlen ({fmtEur(gesamt)})
            </a>
          )}
          {restzahlungOffen && buchung.Stripe_Restzahlung_Link && (
            <a href={buchung.Stripe_Restzahlung_Link} className="px-4 py-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all">
              Restzahlung ({fmtEur(buchung.Restzahlung_Soll_Eur)})
            </a>
          )}
        </div>
      )}

      {/* Angebot-Link + Storno */}
      {variant === "aktiv" && (
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
          {buchung.Token_Angebot && ["Angebot_versendet", "Bestaetigt", "Reserviert"].includes(status) ? (
            <Link href={`/angebot/${buchung.Token_Angebot}`} className="text-sm text-gold-400 hover:text-gold-500">
              Angebot ansehen ↗
            </Link>
          ) : <span />}
          {/* Stornieren nur bei aktiven, noch nicht abgeholten Buchungen */}
          {!["Uebergeben", "In_Miete", "Zurueckgegeben"].includes(status) && (
            <StornoButton
              buchungId={buchung.id}
              eventDatumVon={buchung.Event_datum_von}
              mietsumme={gesamt}
              bezahlt={bezahlt}
            />
          )}
        </div>
      )}
    </div>
  );
}
