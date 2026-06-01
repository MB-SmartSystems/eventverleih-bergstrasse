/**
 * /admin/buchungen — Liste aller Buchungen
 *
 * Filter: Status (alle | aktiv | abgeschlossen | storniert)
 * Drill-Down auf /admin/buchungen/[id]
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listRows, listAllRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Status_Erweitert: { value: string } | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Uebergabe_Termin: string | null;
  Lieferadresse: string | null;
  Gesamt: string | null;
  Kunde_Link: Array<{ id: number; value: string }>;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Email: string;
};

const ACTIVE = new Set([
  "Anfrage",
  "Angebot_erstellt",
  "Angebot_versendet",
  "Reserviert",
  "Bestaetigt",
  "Uebergeben",
  "In_Miete",
]);
const DONE = new Set(["Zurueckgegeben", "Abgerechnet"]);
const CANCELLED = new Set(["Storniert", "No_Show"]);

function statusColor(status: string): string {
  if (ACTIVE.has(status)) return "bg-blue-100 text-blue-700";
  if (DONE.has(status)) return "bg-green-100 text-green-700";
  if (CANCELLED.has(status)) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}.${m}.${y}`;
}

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function fmtEur(v: string | null): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function BuchungenPage({ searchParams }: { searchParams: Promise<{ filter?: string; sort?: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { filter = "alle", sort } = await searchParams;
  const heute = new Date().toISOString().slice(0, 10);
  // Default-Sortierung je Ansicht: "Anstehend" aufsteigend (nächstes zuerst), sonst absteigend (neueste zuerst)
  const defaultSort = filter === "anstehend" ? "event_asc" : "event_desc";
  const sortAsc = (sort ?? defaultSort) === "event_asc";

  const [buchungenList, kundenList] = await Promise.all([
    listAllRows<BuchungRow>(TABLES.Buchungen),
    listAllRows<KundeRow>(TABLES.Kunden),
  ]);

  const kundenById = new Map(kundenList.results.map((k) => [k.id, k]));

  let rows = buchungenList.results;
  if (filter === "anstehend")
    rows = rows.filter(
      (b) =>
        !CANCELLED.has(b.Status_Erweitert?.value ?? "") &&
        (b.Event_datum_bis ?? b.Event_datum_von ?? "") >= heute,
    );
  else if (filter === "aktiv") rows = rows.filter((b) => ACTIVE.has(b.Status_Erweitert?.value ?? ""));
  else if (filter === "abgeschlossen") rows = rows.filter((b) => DONE.has(b.Status_Erweitert?.value ?? ""));
  else if (filter === "storniert") rows = rows.filter((b) => CANCELLED.has(b.Status_Erweitert?.value ?? ""));

  rows.sort((a, b) => {
    const cmp = (a.Event_datum_von ?? "").localeCompare(b.Event_datum_von ?? "");
    return sortAsc ? cmp : -cmp;
  });

  const buildHref = (f: string, s?: string) => {
    const params = new URLSearchParams();
    if (f !== "alle") params.set("filter", f);
    const natural = f === "anstehend" ? "event_asc" : "event_desc";
    if (s && s !== natural) params.set("sort", s);
    const qs = params.toString();
    return `/admin/buchungen${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { key: "alle", label: "Alle", count: buchungenList.results.length },
    { key: "anstehend", label: "Anstehend", count: buchungenList.results.filter((b) => !CANCELLED.has(b.Status_Erweitert?.value ?? "") && (b.Event_datum_bis ?? b.Event_datum_von ?? "") >= heute).length },
    { key: "aktiv", label: "Aktiv", count: buchungenList.results.filter((b) => ACTIVE.has(b.Status_Erweitert?.value ?? "")).length },
    { key: "abgeschlossen", label: "Abgeschlossen", count: buchungenList.results.filter((b) => DONE.has(b.Status_Erweitert?.value ?? "")).length },
    { key: "storniert", label: "Storniert", count: buchungenList.results.filter((b) => CANCELLED.has(b.Status_Erweitert?.value ?? "")).length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-warm-text">Buchungen</h1>
        <p className="text-sm text-warm-muted mt-1">{rows.length} {rows.length === 1 ? "Buchung" : "Buchungen"} angezeigt</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={buildHref(t.key, sort)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === t.key
                ? "bg-accent text-white"
                : "bg-warm-surface text-warm-muted border border-warm-border hover:bg-accent-50"
            }`}
          >
            {t.label} <span className="opacity-60">({t.count})</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="p-8 rounded-xl bg-warm-surface border border-warm-border text-center text-warm-muted">
          Keine Buchungen in diesem Filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-border bg-warm-surface">
          <table className="w-full text-sm">
            <thead className="bg-warm-bg border-b border-warm-border">
              <tr className="text-left text-xs uppercase tracking-wide text-warm-muted">
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">
                  <Link
                    href={buildHref(filter, sortAsc ? "event_desc" : "event_asc")}
                    className="inline-flex items-center gap-1 hover:text-warm-text transition-colors"
                  >
                    Event <span aria-hidden>{sortAsc ? "↑" : "↓"}</span>
                  </Link>
                </th>
                <th className="px-4 py-2.5">Kunde</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const kunde = b.Kunde_Link?.[0]?.id ? kundenById.get(b.Kunde_Link[0].id) : null;
                const status = b.Status_Erweitert?.value ?? "—";
                const hasLieferung = parseFloat(b.Preis_Lieferung ?? "0") > 0;
                const hasAbholung = parseFloat(b.Preis_Abholung ?? "0") > 0;
                const hasAufbau = parseFloat(b.Preis_Aufbau ?? "0") > 0;
                const logistik = hasLieferung
                  ? `Lieferung${hasAufbau ? " + Aufbau" : ""}${hasAbholung ? " + Abholung" : ""}`
                  : "Selbstabholung";
                const ort = hasLieferung
                  ? b.Lieferadresse || "Lieferadresse offen"
                  : "Treffpunkt Grillhütte Sandwiese";
                return (
                  <tr
                    key={b.id}
                    className="border-b border-warm-border last:border-0 hover:bg-accent-50/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-warm-muted">
                      <Link href={`/admin/buchungen/${b.id}`} className="hover:text-accent">
                        #{b.Buchung_ID}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/buchungen/${b.id}`} className="block hover:text-accent">
                        <div className="text-warm-text">{fmtDate(b.Event_datum_von)}</div>
                        {b.Event_datum_bis && b.Event_datum_bis !== b.Event_datum_von && (
                          <div className="text-xs text-warm-muted">bis {fmtDate(b.Event_datum_bis)}</div>
                        )}
                        {b.Uebergabe_Termin && (
                          <div className="text-xs text-accent mt-1">Übergabe {fmtDateTime(b.Uebergabe_Termin)}</div>
                        )}
                        <div className="text-xs text-warm-muted">{logistik} · {ort}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {kunde ? (
                        <div>
                          <div className="text-warm-text">
                            {kunde.Vorname} {kunde.Nachname}
                          </div>
                          {kunde.Email && <div className="text-xs text-warm-muted">{kunde.Email}</div>}
                        </div>
                      ) : (
                        <span className="text-warm-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(status)}`}>
                        {status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-warm-text">
                      {fmtEur(
                        (
                          (parseFloat(b.Preis_Artikel || "0") || 0) +
                          (parseFloat(b.Preis_Lieferung || "0") || 0) +
                          (parseFloat(b.Preis_Abholung || "0") || 0) +
                          (parseFloat(b.Preis_Aufbau || "0") || 0)
                        ).toFixed(2),
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
