/**
 * /admin/elster — ELSTER-EÜR Übersicht je Jahr
 *
 * Aggregiert Einnahmen/Ausgaben nach ELSTER_Zeile_Mapping.
 * Bietet CSV-Export pro Jahr.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listRows, listAllRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ELSTER = {
  id: number;
  Zeile_Code: string;
  Bezeichnung: string;
  Kategorie: { value: string } | null;
  Beschreibung: string;
};

type EinnahmeRow = {
  id: number;
  Datum: string | null;
  Beschreibung: string;
  Betrag_Eur: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

type AusgabeRow = {
  id: number;
  Datum: string | null;
  Beschreibung: string;
  Verkaeufer: string;
  Betrag_Eur: string | null;
  AfA_relevant: boolean;
  AfA_Nutzungsdauer_Jahre: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

type FahrtRow = {
  id: number;
  Datum: string | null;
  Strecke_km: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

function num(v: string | null): number {
  return parseFloat(v ?? "0") || 0;
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export default async function ElsterPage({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { jahr: jahrParam } = await searchParams;
  const jahr = parseInt(jahrParam ?? String(new Date().getFullYear()), 10);

  const [elsterList, einnahmenList, ausgabenList, fahrtenList] = await Promise.all([
    listAllRows<ELSTER>(TABLES.ELSTER_Zeile_Mapping),
    listAllRows<EinnahmeRow>(TABLES.Einnahmen),
    listAllRows<AusgabeRow>(TABLES.Ausgaben),
    listAllRows<FahrtRow>(TABLES.Fahrten).catch(() => ({ count: 0, results: [] as FahrtRow[] })),
  ]);

  const einnahmen = einnahmenList.results.filter((e) => e.Datum?.startsWith(String(jahr)));
  const ausgaben = ausgabenList.results.filter((a) => a.Datum?.startsWith(String(jahr)));

  type Zeile = ELSTER & { summe: number; count: number };
  const elsterMap = new Map<number, Zeile>();
  for (const z of elsterList.results) elsterMap.set(z.id, { ...z, summe: 0, count: 0 });

  let unmapped = { einnahmen: 0, ausgaben: 0 };
  for (const e of einnahmen) {
    const linkId = e.ELSTER_Zeile_Link?.[0]?.id;
    if (linkId && elsterMap.has(linkId)) {
      const z = elsterMap.get(linkId)!;
      z.summe += num(e.Betrag_Eur);
      z.count += 1;
    } else {
      unmapped.einnahmen += num(e.Betrag_Eur);
    }
  }
  for (const a of ausgaben) {
    const linkId = a.ELSTER_Zeile_Link?.[0]?.id;
    if (linkId && elsterMap.has(linkId)) {
      const z = elsterMap.get(linkId)!;
      z.summe += num(a.Betrag_Eur);
      z.count += 1;
    } else {
      unmapped.ausgaben += num(a.Betrag_Eur);
    }
  }

  const einnahmenZeilen = Array.from(elsterMap.values()).filter(
    (z) => z.Kategorie?.value === "Einnahme" && z.summe > 0
  );
  const ausgabenZeilen = Array.from(elsterMap.values()).filter(
    (z) => (z.Kategorie?.value === "Ausgabe" || z.Kategorie?.value === "Fahrt") && z.summe > 0
  );

  const totalEinnahmen = einnahmenZeilen.reduce((s, z) => s + z.summe, 0) + unmapped.einnahmen;
  const totalAusgaben = ausgabenZeilen.reduce((s, z) => s + z.summe, 0) + unmapped.ausgaben;
  const gewinn = totalEinnahmen - totalAusgaben;

  // AfA-relevante Anschaffungen
  const afa = ausgaben.filter((a) => a.AfA_relevant);

  // Verfügbare Jahre
  const alleJahreSet = new Set<number>();
  for (const e of einnahmenList.results) if (e.Datum) alleJahreSet.add(parseInt(e.Datum.slice(0, 4), 10));
  for (const a of ausgabenList.results) if (a.Datum) alleJahreSet.add(parseInt(a.Datum.slice(0, 4), 10));
  alleJahreSet.add(new Date().getFullYear());
  const jahre = Array.from(alleJahreSet).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-warm-text">ELSTER-EÜR {jahr}</h1>
          <p className="text-sm text-warm-muted mt-1">
            Übersicht für Einnahmen-Überschuss-Rechnung • §19 UStG (keine USt)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {jahre.map((j) => (
            <Link
              key={j}
              href={`/admin/elster?jahr=${j}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                j === jahr
                  ? "bg-accent text-white"
                  : "bg-warm-surface text-warm-muted border border-warm-border hover:bg-accent-50"
              }`}
            >
              {j}
            </Link>
          ))}
          <a
            href={`/api/admin/elster/export?jahr=${jahr}`}
            className="ml-2 px-3 py-1.5 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark"
          >
            ↓ CSV-Export
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-green-50 border border-green-200">
          <div className="text-xs text-green-700 uppercase tracking-wide">Einnahmen</div>
          <div className="text-2xl font-bold text-green-800 mt-1">{fmtEur(totalEinnahmen)}</div>
        </div>
        <div className="p-5 rounded-xl bg-red-50 border border-red-200">
          <div className="text-xs text-red-700 uppercase tracking-wide">Ausgaben</div>
          <div className="text-2xl font-bold text-red-800 mt-1">{fmtEur(totalAusgaben)}</div>
        </div>
        <div className={`p-5 rounded-xl border ${gewinn >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
          <div className="text-xs uppercase tracking-wide text-warm-muted">Gewinn (EÜR)</div>
          <div className={`text-2xl font-bold mt-1 ${gewinn >= 0 ? "text-blue-800" : "text-red-800"}`}>
            {fmtEur(gewinn)}
          </div>
        </div>
      </div>

      {/* Einnahmen-Zeilen */}
      <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
        <h2 className="text-lg font-semibold text-warm-text mb-3">Einnahmen-Zeilen</h2>
        {einnahmenZeilen.length === 0 ? (
          <p className="text-sm text-warm-muted">Keine Einnahmen für {jahr}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-warm-muted border-b border-warm-border">
                <th className="py-2">Zeile</th>
                <th>Bezeichnung</th>
                <th className="text-right">Posten</th>
                <th className="text-right">Summe</th>
              </tr>
            </thead>
            <tbody>
              {einnahmenZeilen.map((z) => (
                <tr key={z.id} className="border-b border-warm-border/50 last:border-0">
                  <td className="py-2 font-mono text-xs text-warm-muted">{z.Zeile_Code}</td>
                  <td className="text-warm-text">{z.Bezeichnung}</td>
                  <td className="text-right text-warm-muted">{z.count}</td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(z.summe)}</td>
                </tr>
              ))}
              {unmapped.einnahmen > 0 && (
                <tr className="bg-yellow-50">
                  <td className="py-2 font-mono text-xs text-yellow-700">—</td>
                  <td className="text-yellow-800">Achtung: Ohne ELSTER-Zuordnung</td>
                  <td></td>
                  <td className="text-right font-mono text-yellow-800">{fmtEur(unmapped.einnahmen)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* Ausgaben-Zeilen */}
      <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
        <h2 className="text-lg font-semibold text-warm-text mb-3">Ausgaben-Zeilen</h2>
        {ausgabenZeilen.length === 0 ? (
          <p className="text-sm text-warm-muted">Keine Ausgaben für {jahr}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-warm-muted border-b border-warm-border">
                <th className="py-2">Zeile</th>
                <th>Bezeichnung</th>
                <th className="text-right">Posten</th>
                <th className="text-right">Summe</th>
              </tr>
            </thead>
            <tbody>
              {ausgabenZeilen.map((z) => (
                <tr key={z.id} className="border-b border-warm-border/50 last:border-0">
                  <td className="py-2 font-mono text-xs text-warm-muted">{z.Zeile_Code}</td>
                  <td className="text-warm-text">{z.Bezeichnung}</td>
                  <td className="text-right text-warm-muted">{z.count}</td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(z.summe)}</td>
                </tr>
              ))}
              {unmapped.ausgaben > 0 && (
                <tr className="bg-yellow-50">
                  <td className="py-2 font-mono text-xs text-yellow-700">—</td>
                  <td className="text-yellow-800">Achtung: Ohne ELSTER-Zuordnung</td>
                  <td></td>
                  <td className="text-right font-mono text-yellow-800">{fmtEur(unmapped.ausgaben)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* AfA-Hinweis */}
      {afa.length > 0 && (
        <section className="p-5 rounded-xl bg-amber-50 border border-amber-200">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">AfA-relevante Anschaffungen ({afa.length})</h2>
          <p className="text-xs text-amber-800 mb-3">
            Diese Anschaffungen sind über Nutzungsdauer abzuschreiben. Im CSV-Export getrennt ausgewiesen.
          </p>
          <ul className="text-xs text-amber-900 space-y-1">
            {afa.map((a) => (
              <li key={a.id}>
                {a.Datum?.slice(0, 10)} • {a.Beschreibung} • {fmtEur(num(a.Betrag_Eur))}
                {a.AfA_Nutzungsdauer_Jahre && ` • Nutzungsdauer ${a.AfA_Nutzungsdauer_Jahre} Jahre`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Hinweis */}
      <section className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
        <strong>Hinweis:</strong> Diese Übersicht aggregiert ohne Steuerberater-Korrektur. Vor ELSTER-Versand
        prüfen, ob alle ELSTER-Zeilen gefüllt sind und keine Position unter „Ohne ELSTER-Zuordnung" steht.
      </section>
    </div>
  );
}
