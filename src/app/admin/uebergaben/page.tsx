/**
 * /admin/uebergaben — Mobile-fokussierte Übergabe-Ansicht
 *
 * Für unterwegs: anstehende + aktive Buchungen (nächste 7 Tage + aktuell draußen),
 * je Buchung die PACKLISTE (Artikel × Anzahl), Zahlungs-/Kautions-Status und ein
 * direkter Link zur Detailseite, wo Barzahlung quittiert + Übergabe/Rücknahme
 * bestätigt werden (ZahlungsPanel / UebergabeDialog — funktionieren am Handy).
 */
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listAllRows, TABLES } from "@/lib/baserow/client";
import UebergabeActions from "./UebergabeActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BuchungRow {
  id: number;
  Buchung_ID?: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Uebergabe_Termin: string | null;
  Anzahlung_Soll_Eur: string | number | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Soll_Eur: string | number | null;
  Restzahlung_Bezahlt_am: string | null;
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Standort_Typ: { value: string } | null;
  Lieferadresse: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

interface PositionRow {
  id: number;
  Anzahl: string | null;
  Artikel_Link: Array<{ id: number; value: string }> | null;
  Buchung_Link: Array<{ id: number }> | null;
}

interface KundeRow {
  id: number;
  Vorname?: string;
  Nachname?: string;
  Telefon?: string;
}

const AKTIV = new Set(["Bestaetigt", "Reserviert", "Uebergeben", "In_Miete"]);

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function daysFromToday(s: string | null): number | null {
  if (!s) return null;
  const d = new Date(s.slice(0, 10));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

const STATUS_LABEL: Record<string, string> = {
  Bestaetigt: "Bestätigt",
  Reserviert: "Reserviert",
  Uebergeben: "Übergeben",
  In_Miete: "In Miete",
};

export default async function UebergabenPage() {
  if (!(await isAuthenticated())) redirect("/admin");

  const [buchungenAll, positionenAll, artikelAll, kundenAll] = await Promise.all([
    listAllRows<BuchungRow>(TABLES.Buchungen),
    listAllRows<PositionRow>(TABLES.Buchungs_Position),
    listAllRows<{ id: number; Bezeichnung: string }>(TABLES.Artikel),
    listAllRows<KundeRow>(TABLES.Kunden),
  ]);

  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  const kundeById = new Map(kundenAll.results.map((k) => [k.id, k]));

  // Packliste je Buchung
  const packByBuchung = new Map<number, Array<{ positionId: number; label: string; checked: boolean }>>();
  for (const p of positionenAll.results) {
    const bid = p.Buchung_Link?.[0]?.id;
    if (!bid) continue;
    const aid = p.Artikel_Link?.[0]?.id;
    const name = aid ? artikelNameById.get(aid) ?? `Artikel ${aid}` : "—";
    const anzahl = parseInt(p.Anzahl ?? "1", 10) || 1;
    const list = packByBuchung.get(bid) ?? [];
    list.push({ positionId: p.id, label: `${anzahl}× ${name}`, checked: false });
    packByBuchung.set(bid, list);
  }

  // Relevante Buchungen: aktiv + (Termin in den nächsten 7 Tagen / heute / überfällig) ODER aktuell draußen
  const relevant = buchungenAll.results
    .filter((b) => {
      const s = b.Status_Erweitert?.value || "";
      if (!AKTIV.has(s)) return false;
      if (s === "Uebergeben" || s === "In_Miete") return true; // aktuell draußen → immer zeigen
      const d = daysFromToday(b.Event_datum_von);
      return d !== null && d >= -1 && d <= 7; // anstehende Übergaben (inkl. heute/morgen)
    })
    .sort((a, b) => (a.Event_datum_von || "").localeCompare(b.Event_datum_von || ""));

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold text-warm-text">Übergaben</h1>
        <p className="text-sm text-warm-muted mt-0.5">
          Anstehende & laufende Buchungen mit Packliste — fürs Handy unterwegs.
        </p>
      </div>

      {relevant.length === 0 ? (
        <div className="p-6 rounded-xl bg-warm-surface border border-warm-border text-center text-warm-muted text-sm">
          Keine anstehenden Übergaben in den nächsten 7 Tagen.
        </div>
      ) : (
        <div className="space-y-3">
          {relevant.map((b) => {
            const status = b.Status_Erweitert?.value || "";
            const kunde = b.Kunde_Link?.[0]?.id ? kundeById.get(b.Kunde_Link[0].id) : null;
            const kundeName = kunde
              ? `${kunde.Vorname ?? ""} ${kunde.Nachname ?? ""}`.trim()
              : b.Kunde_Link?.[0]?.value || "—";
            const tel = kunde?.Telefon?.trim();
            const pack = packByBuchung.get(b.id) ?? [];
            const dTage = daysFromToday(b.Event_datum_von);
            const dLabel =
              dTage === 0 ? "HEUTE" : dTage === 1 ? "morgen" : dTage !== null && dTage < 0 ? `${-dTage}d überfällig` : dTage !== null ? `in ${dTage}d` : "";

            const kautionSoll = num(b.Kaution_Soll_Eur);
            const kautionOffen = kautionSoll > 0 && !b.Kaution_Hinterlegt_am;

            return (
              <div key={b.id} className="rounded-xl border border-warm-border bg-warm-surface p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-warm-text">{kundeName}</div>
                    <div className="text-sm text-warm-muted">
                      {fmtDate(b.Event_datum_von)}
                      {b.Event_datum_bis && b.Event_datum_bis !== b.Event_datum_von ? ` – ${fmtDate(b.Event_datum_bis)}` : ""}
                      {dLabel && <span className="ml-2 text-accent font-medium">{dLabel}</span>}
                    </div>
                    {b.Uebergabe_Termin && (
                      <div className="text-sm text-accent font-medium mt-0.5">
                        Übergabe/Abholung: {fmtDateTime(b.Uebergabe_Termin)}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs px-2 py-1 rounded bg-warm-bg border border-warm-border text-warm-muted">
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </div>

                {tel && (
                  <a href={`tel:${tel.replace(/\s/g, "")}`} className="text-sm text-accent">
                    {tel}
                  </a>
                )}

                <UebergabeActions
                  buchungId={b.id}
                  packItems={pack}
                  anzahlungOffen={num(b.Anzahlung_Soll_Eur) > 0 && !b.Anzahlung_Bezahlt_am}
                  anzahlungSoll={num(b.Anzahlung_Soll_Eur)}
                  restzahlungOffen={num(b.Restzahlung_Soll_Eur) > 0 && !b.Restzahlung_Bezahlt_am}
                  restzahlungSoll={num(b.Restzahlung_Soll_Eur)}
                  kautionOffen={kautionOffen}
                  kautionSoll={kautionSoll}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
