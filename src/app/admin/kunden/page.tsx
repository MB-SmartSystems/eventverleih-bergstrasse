/**
 * /admin/kunden — Kundenliste mit Suche
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KundeRow = {
  id: number;
  Kunde_ID: number;
  Vorname: string;
  Nachname: string;
  Firma: string;
  Email: string;
  Telefon: string;
  Adresse_Ort: string;
  Stammkunde_Wertung: { value: string } | null;
  Buchungen: Array<{ id: number; value: string }>;
};

export default async function KundenPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { q = "" } = await searchParams;

  const list = await listRows<KundeRow>(TABLES.Kunden, { size: 500 });
  const term = q.trim().toLowerCase();
  let rows = list.results;
  if (term) {
    rows = rows.filter((k) =>
      `${k.Vorname} ${k.Nachname} ${k.Firma ?? ""} ${k.Email ?? ""} ${k.Telefon ?? ""} ${k.Adresse_Ort ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }
  rows.sort((a, b) => `${a.Nachname} ${a.Vorname}`.localeCompare(`${b.Nachname} ${b.Vorname}`));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-warm-text">Kunden</h1>
        <p className="text-sm text-warm-muted mt-1">
          {rows.length} {rows.length === 1 ? "Kunde" : "Kunden"} {term && `gefiltert nach „${term}"`}
        </p>
      </div>

      <form className="flex gap-2 max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Suche: Name, E-Mail, Telefon, Ort …"
          className="flex-1 px-3 py-2 rounded-lg border border-warm-border bg-warm-surface text-warm-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark">Suchen</button>
      </form>

      {rows.length === 0 ? (
        <div className="p-8 rounded-xl bg-warm-surface border border-warm-border text-center text-warm-muted">
          Keine Treffer.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-warm-border bg-warm-surface">
          <table className="w-full text-sm">
            <thead className="bg-warm-bg border-b border-warm-border">
              <tr className="text-left text-xs uppercase tracking-wide text-warm-muted">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Kontakt</th>
                <th className="px-4 py-2.5">Ort</th>
                <th className="px-4 py-2.5">Wertung</th>
                <th className="px-4 py-2.5 text-right">Buchungen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id} className="border-b border-warm-border last:border-0 hover:bg-accent-50/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/kunden/${k.id}`} className="block hover:text-accent">
                      <div className="text-warm-text font-medium">
                        {k.Vorname} {k.Nachname}
                      </div>
                      {k.Firma && <div className="text-xs text-warm-muted">{k.Firma}</div>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {k.Email && (
                      <a href={`mailto:${k.Email}`} className="text-warm-muted hover:text-accent block">
                        {k.Email}
                      </a>
                    )}
                    {k.Telefon && (
                      <a href={`tel:${k.Telefon}`} className="text-warm-muted hover:text-accent block">
                        {k.Telefon}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-warm-muted text-xs">{k.Adresse_Ort || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {k.Stammkunde_Wertung?.value && (
                      <span className="inline-block px-2 py-0.5 rounded bg-accent-50 text-accent-dark">
                        {k.Stammkunde_Wertung.value}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-warm-text font-mono">{k.Buchungen?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
