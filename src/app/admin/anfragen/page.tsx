/**
 * /admin/anfragen — Liste aller offenen Anfragen
 *
 * Server-side render. Auth via Cookie.
 * Filtert auf Buchungen mit Status_Erweitert in [Anfrage, Angebot_erstellt,
 * Angebot_versendet] (noch NICHT vom Kunden bestaetigt) UND Anzahlung_Bezahlt_am == null.
 * Sobald der Kunde bestaetigt (Status Bestaetigt), faellt der Vorgang hier raus und
 * lebt als Buchung weiter (Buchungen-Liste, Status "Kunde hat bestaetigt / Anzahlung steht aus").
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listAllRows, TABLES } from "@/lib/baserow/client";
import { getNextAction, type NextActionTone } from "@/lib/eventverleih/next-action";
import AnfrageQuickActions from "./AnfrageQuickActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Anzahlung_Soll_Eur: number | string | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Soll_Eur: number | string | null;
  Restzahlung_Bezahlt_am: string | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Preis_Artikel: string | null;
  Notizen: string | null;
  Kunde_Link: Array<{ id: number; value: string }>;
};

type AngebotRow = {
  id: number;
  Angebot_ID: number;
  Angebotsnummer: string;
  Anfragetext: string | null;
  Anfragedatum: string | null;
  Akzeptiert_am: string | null;
  Buchung_Link: Array<{ id: number; value: string }>;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Email: string;
  Telefon: string;
};

const RELEVANT_STATUS = new Set([
  "Anfrage",
  "Angebot_erstellt",
  "Angebot_versendet",
]);

const STATUS_LABELS: Record<string, { label: string; tone: "blue" | "yellow" | "amber" }> = {
  Anfrage: { label: "Anfrage", tone: "blue" },
  Angebot_erstellt: { label: "Angebot erstellt", tone: "blue" },
  Angebot_versendet: { label: "Angebot versendet", tone: "yellow" },
  Bestaetigt: { label: "Kunde hat bestätigt", tone: "amber" },
};

const TONE_CLASSES: Record<"blue" | "yellow" | "amber", string> = {
  blue: "bg-blue-500/20 text-blue-200",
  yellow: "bg-yellow-500/20 text-yellow-200",
  amber: "bg-amber-500/20 text-amber-200",
};

const NEXT_ACTION_CLASSES: Record<NextActionTone, string> = {
  blue: "text-blue-300",
  amber: "text-amber-300",
  red: "text-red-300",
  green: "text-green-300",
  gray: "text-gray-400",
};

function fmtDateDe(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}.${m}.${y}`;
}

function formatRange(von: string | null, bis: string | null): string {
  const vonStr = fmtDateDe(von);
  const bisStr = fmtDateDe(bis);
  if (vonStr === "—" && bisStr === "—") return "Zeitraum fehlt";
  if (vonStr === bisStr) return vonStr;
  return `${vonStr} – ${bisStr}`;
}

export default async function AnfragenPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { sort = "datum" } = await searchParams;

  const [buchungenAll, angeboteAll, kundenAll] = await Promise.all([
    listAllRows<BuchungRow>(TABLES.Buchungen),
    listAllRows<AngebotRow>(TABLES.Angebote),
    listAllRows<KundeRow>(TABLES.Kunden),
  ]);

  const offen = buchungenAll.results.filter((b) => {
    const s = b.Status_Erweitert?.value || "";
    if (!RELEVANT_STATUS.has(s)) return false;
    if (b.Anzahlung_Bezahlt_am) return false;
    return true;
  });

  const kundenById = new Map(kundenAll.results.map((k) => [k.id, k]));
  const kundeName = (b: BuchungRow): string => {
    const k = kundenById.get(b.Kunde_Link?.[0]?.id ?? -1);
    return k ? `${k.Nachname} ${k.Vorname}`.trim().toLowerCase() : "";
  };
  // Sortierung nach Wahl: Startdatum (Default, aufsteigend) | Name (A–Z) | Mietbetrag (absteigend)
  offen.sort((a, b) => {
    if (sort === "name") return kundeName(a).localeCompare(kundeName(b));
    if (sort === "betrag")
      return (parseFloat(b.Preis_Artikel || "0") || 0) - (parseFloat(a.Preis_Artikel || "0") || 0);
    return (a.Event_datum_von || "").localeCompare(b.Event_datum_von || "");
  });

  const angebotByBuchungId = new Map<number, AngebotRow>();
  for (const a of angeboteAll.results) {
    const bid = a.Buchung_Link?.[0]?.id;
    if (bid && !angebotByBuchungId.has(bid)) angebotByBuchungId.set(bid, a);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Offene Anfragen</h1>
          <p className="text-sm text-gray-400 mt-1">
            {offen.length} {offen.length === 1 ? "Anfrage" : "Anfragen"} — offen bis der Kunde bestätigt
          </p>
        </div>
        <Link
          href="/admin/anfragen/neu"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-gold-500/20 text-gold-300 hover:bg-gold-500/30 transition-all text-sm font-medium"
        >
          + Neue Anfrage anlegen
        </Link>
      </div>

      {offen.length > 0 && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-gray-500">Sortieren:</span>
          {(
            [
              ["datum", "Startdatum"],
              ["name", "Name"],
              ["betrag", "Mietbetrag"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={key === "datum" ? "/admin/anfragen" : `/admin/anfragen?sort=${key}`}
              className={`px-3 py-1 rounded-lg transition-colors ${
                sort === key
                  ? "bg-gold-500/20 text-gold-300"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {offen.length === 0 ? (
        <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-gray-400">
          Keine offenen Anfragen — du bist auf dem Stand.
        </div>
      ) : (
        <div className="space-y-3">
          {offen.map((b) => {
            const angebot = angebotByBuchungId.get(b.id);
            const kunde = b.Kunde_Link?.[0]?.id ? kundenById.get(b.Kunde_Link[0].id) : null;
            const preisArtikel = b.Preis_Artikel ? parseFloat(b.Preis_Artikel) : 0;
            const statusKey = b.Status_Erweitert?.value || "";
            const statusInfo = STATUS_LABELS[statusKey] ?? { label: statusKey, tone: "blue" as const };
            const href = angebot ? `/admin/anfragen/${angebot.id}` : `/admin/buchungen/${b.id}`;
            const snippet = (angebot?.Anfragetext || b.Notizen || "").slice(0, 200);
            const nextAction = getNextAction({
              Status_Erweitert: b.Status_Erweitert,
              Event_datum_von: b.Event_datum_von,
              Event_datum_bis: b.Event_datum_bis,
              Anzahlung_Soll_Eur: b.Anzahlung_Soll_Eur,
              Anzahlung_Bezahlt_am: b.Anzahlung_Bezahlt_am,
              Restzahlung_Soll_Eur: b.Restzahlung_Soll_Eur,
              Restzahlung_Bezahlt_am: b.Restzahlung_Bezahlt_am,
              Kaution_Hinterlegt_am: b.Kaution_Hinterlegt_am,
              Kaution_Rueckzahlung_am: b.Kaution_Rueckzahlung_am,
              Akzeptiert_am: angebot?.Akzeptiert_am || null,
            });
            return (
              <div
                key={b.id}
                className="block p-5 rounded-xl bg-white/5 border border-white/10 hover:border-gold-500/30 transition-all"
              >
                <Link href={href} className="block group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${TONE_CLASSES[statusInfo.tone]}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-gold-500/20 text-gold-300 font-mono">
                          {formatRange(b.Event_datum_von, b.Event_datum_bis)}
                        </span>
                        {angebot && (
                          <span className="text-xs text-gray-500 font-mono">{angebot.Angebotsnummer}</span>
                        )}
                        {angebot?.Anfragedatum && (
                          <span className="text-xs text-gray-500">Anfrage vom {fmtDateDe(angebot.Anfragedatum)}</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-gold-200 transition-colors">
                        {kunde ? `${kunde.Vorname} ${kunde.Nachname}` : "Unbekannter Kunde"}
                      </h3>
                      {kunde?.Email && <p className="text-sm text-gray-400">{kunde.Email}</p>}
                      {snippet && (
                        <p className="text-sm text-gray-400 mt-2 line-clamp-2">{snippet}</p>
                      )}
                      <div className={`text-xs mt-3 font-medium ${NEXT_ACTION_CLASSES[nextAction.tone]}`}>
                        → {nextAction.label}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {preisArtikel > 0 ? (
                        <div>
                          <div className="text-2xl font-bold text-white">{preisArtikel.toFixed(2)} €</div>
                          <div className="text-xs text-gray-500">Mietsumme</div>
                        </div>
                      ) : (
                        <div className="text-xs text-yellow-400">Preis fehlt</div>
                      )}
                    </div>
                  </div>
                </Link>
                <AnfrageQuickActions angebotId={angebot?.id ?? null} status={statusKey} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
