/**
 * /admin/rechnungen — Rechnungsliste mit Filter (Status, Jahr)
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listRows, listAllRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Rechnungsdatum: string | null;
  Status: { value: string } | null;
  Typ_Erweitert: { value: string } | null;
  Betrag_Gesamt: string | null;
  Mahnstufe: { value: string } | null;
  Bezahlt_am: string | null;
  Kunde_Link: Array<{ id: number; value: string }>;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function fmtEur(v: string | null): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { filter = "alle" } = await searchParams;

  const [rechnungenList, kundenList] = await Promise.all([
    listAllRows<RechnungRow>(TABLES.Rechnungen),
    listAllRows<KundeRow>(TABLES.Kunden),
  ]);
  const kundenById = new Map(kundenList.results.map((k) => [k.id, k]));

  let rows = rechnungenList.results;
  if (filter === "offen") rows = rows.filter((r) => r.Status?.value !== "Bezahlt");
  else if (filter === "bezahlt") rows = rows.filter((r) => r.Status?.value === "Bezahlt");
  else if (filter === "mahnung") rows = rows.filter((r) => r.Mahnstufe?.value && r.Mahnstufe.value !== "keine");

  rows.sort((a, b) => (b.Rechnungsdatum ?? "").localeCompare(a.Rechnungsdatum ?? ""));

  const totalOffen = rechnungenList.results
    .filter((r) => r.Status?.value !== "Bezahlt")
    .reduce((s, r) => s + (parseFloat(r.Betrag_Gesamt ?? "0") || 0), 0);

  const tabs = [
    { key: "alle", label: "Alle", count: rechnungenList.results.length },
    { key: "offen", label: "Offen", count: rechnungenList.results.filter((r) => r.Status?.value !== "Bezahlt").length },
    { key: "bezahlt", label: "Bezahlt", count: rechnungenList.results.filter((r) => r.Status?.value === "Bezahlt").length },
    {
      key: "mahnung",
      label: "Mahnung",
      count: rechnungenList.results.filter((r) => r.Mahnstufe?.value && r.Mahnstufe.value !== "keine").length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-warm-text">Belege</h1>
          <p className="text-sm text-warm-muted mt-1">{rows.length} {rows.length === 1 ? "Beleg" : "Belege"}</p>
        </div>
        {totalOffen > 0 && (
          <div className="text-right">
            <div className="text-xs text-warm-muted">Offen gesamt</div>
            <div className="text-xl font-bold text-warm-text">{totalOffen.toFixed(2).replace(".", ",")} €</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/rechnungen${t.key === "alle" ? "" : `?filter=${t.key}`}`}
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
          Keine Belege.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-border bg-warm-surface">
          <table className="w-full text-sm">
            <thead className="bg-warm-bg border-b border-warm-border">
              <tr className="text-left text-xs uppercase tracking-wide text-warm-muted">
                <th className="px-4 py-2.5">Nr.</th>
                <th className="px-4 py-2.5">Datum</th>
                <th className="px-4 py-2.5">Kunde</th>
                <th className="px-4 py-2.5">Typ</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kunde = r.Kunde_Link?.[0]?.id ? kundenById.get(r.Kunde_Link[0].id) : null;
                return (
                  <tr key={r.id} className="border-b border-warm-border last:border-0 hover:bg-accent-50/40">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/admin/rechnungen/${r.id}`} className="text-warm-text hover:text-accent">
                        {r.Rechnungsnummer}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-warm-muted text-xs">{fmtDate(r.Rechnungsdatum)}</td>
                    <td className="px-4 py-3 text-warm-text text-xs">
                      {kunde ? `${kunde.Vorname} ${kunde.Nachname}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-warm-muted text-xs">{r.Typ_Erweitert?.value ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-block px-2 py-0.5 rounded text-xs font-medium " +
                          (r.Status?.value === "Bezahlt"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700")
                        }
                      >
                        {r.Status?.value ?? "—"}
                      </span>
                      {r.Mahnstufe?.value && r.Mahnstufe.value !== "keine" && (
                        <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                          {r.Mahnstufe.value}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-warm-text">{fmtEur(r.Betrag_Gesamt)}</td>
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
