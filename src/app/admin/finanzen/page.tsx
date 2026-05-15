/**
 * /admin/finanzen — Einnahmen + Ausgaben + Statistik
 *
 * Jahres-Filter, KPIs, Monatsverlauf, Top-Artikel.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listRows, listAllRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EinnahmeRow = {
  id: number;
  Datum: string | null;
  Beschreibung: string;
  Betrag_Eur: string | null;
  Jahr: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

type AusgabeRow = {
  id: number;
  Datum: string | null;
  Beschreibung: string;
  Verkaeufer: string;
  Betrag_Eur: string | null;
  Jahr: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

type RechnungRow = {
  id: number;
  Rechnungsdatum: string | null;
  Status: { value: string } | null;
  Betrag_Gesamt: string | null;
};

type PositionRow = {
  id: number;
  Anzahl: string;
  Position_Gesamt_Eur: string;
  Artikel_Link: Array<{ id: number; value: string }>;
  Buchung_Link: Array<{ id: number }>;
};

type BuchungRow = {
  id: number;
  Event_datum_von: string | null;
  Status_Erweitert: { value: string } | null;
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function num(v: string | null): number {
  return parseFloat(v ?? "0") || 0;
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

const MONATE = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function FinanzenPage({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { jahr: jahrParam } = await searchParams;
  const jahr = parseInt(jahrParam ?? String(new Date().getFullYear()), 10);

  const [einnahmenList, ausgabenList, rechnungenList, positionenList, buchungenList] = await Promise.all([
    listAllRows<EinnahmeRow>(TABLES.Einnahmen),
    listAllRows<AusgabeRow>(TABLES.Ausgaben),
    listAllRows<RechnungRow>(TABLES.Rechnungen),
    listAllRows<PositionRow>(TABLES.Buchungs_Position),
    listAllRows<BuchungRow>(TABLES.Buchungen),
  ]);

  const einnahmen = einnahmenList.results.filter((e) => e.Datum?.startsWith(String(jahr)));
  const ausgaben = ausgabenList.results.filter((a) => a.Datum?.startsWith(String(jahr)));
  const summeEinnahmen = einnahmen.reduce((s, e) => s + num(e.Betrag_Eur), 0);
  const summeAusgaben = ausgaben.reduce((s, a) => s + num(a.Betrag_Eur), 0);
  const gewinn = summeEinnahmen - summeAusgaben;

  // Rechnungs-KPIs
  const rechnungenJahr = rechnungenList.results.filter((r) => r.Rechnungsdatum?.startsWith(String(jahr)));
  const offenSumme = rechnungenJahr.filter((r) => r.Status?.value !== "Bezahlt").reduce((s, r) => s + num(r.Betrag_Gesamt), 0);
  const offenCount = rechnungenJahr.filter((r) => r.Status?.value !== "Bezahlt").length;

  // Monats-Verlauf (Einnahmen vs Ausgaben)
  const monatsVerlauf = MONATE.map((_, idx) => {
    const monatPrefix = `${jahr}-${String(idx + 1).padStart(2, "0")}`;
    const eIn = einnahmen.filter((e) => e.Datum?.startsWith(monatPrefix)).reduce((s, e) => s + num(e.Betrag_Eur), 0);
    const eOut = ausgaben.filter((a) => a.Datum?.startsWith(monatPrefix)).reduce((s, a) => s + num(a.Betrag_Eur), 0);
    return { monat: MONATE[idx], ein: eIn, aus: eOut };
  });
  const maxMonatswert = Math.max(1, ...monatsVerlauf.map((m) => Math.max(m.ein, m.aus)));

  // Top-Artikel im Jahr (basierend auf Buchungen)
  const buchungenJahrIds = new Set(
    buchungenList.results.filter((b) => b.Event_datum_von?.startsWith(String(jahr))).map((b) => b.id)
  );
  const positionenJahr = positionenList.results.filter((p) => p.Buchung_Link?.[0]?.id && buchungenJahrIds.has(p.Buchung_Link[0].id));
  const artikelMap = new Map<string, { name: string; anzahl: number; umsatz: number }>();
  for (const p of positionenJahr) {
    const name = p.Artikel_Link?.[0]?.value;
    if (!name) continue;
    const cur = artikelMap.get(name) ?? { name, anzahl: 0, umsatz: 0 };
    cur.anzahl += parseInt(p.Anzahl ?? "0", 10) || 0;
    cur.umsatz += num(p.Position_Gesamt_Eur);
    artikelMap.set(name, cur);
  }
  const topArtikel = Array.from(artikelMap.values())
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 10);

  // Verfügbare Jahre dynamisch
  const alleJahreSet = new Set<number>();
  for (const e of einnahmenList.results) {
    if (e.Datum) alleJahreSet.add(parseInt(e.Datum.slice(0, 4), 10));
  }
  for (const a of ausgabenList.results) {
    if (a.Datum) alleJahreSet.add(parseInt(a.Datum.slice(0, 4), 10));
  }
  alleJahreSet.add(new Date().getFullYear());
  const jahre = Array.from(alleJahreSet).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-warm-text">Finanzen</h1>
          <p className="text-sm text-warm-muted mt-1">Übersicht Einnahmen, Ausgaben und Kennzahlen für {jahr}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {jahre.map((j) => (
            <Link
              key={j}
              href={`/admin/finanzen?jahr=${j}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                j === jahr
                  ? "bg-accent text-white"
                  : "bg-warm-surface text-warm-muted border border-warm-border hover:bg-accent-50"
              }`}
            >
              {j}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <div className="text-xs text-warm-muted uppercase tracking-wide">Einnahmen</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{fmtEur(summeEinnahmen)}</div>
          <div className="text-xs text-warm-muted mt-1">{einnahmen.length} Buchungen</div>
        </div>
        <div className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <div className="text-xs text-warm-muted uppercase tracking-wide">Ausgaben</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{fmtEur(summeAusgaben)}</div>
          <div className="text-xs text-warm-muted mt-1">{ausgaben.length} Belege</div>
        </div>
        <div className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <div className="text-xs text-warm-muted uppercase tracking-wide">Gewinn (vorl.)</div>
          <div className={`text-2xl font-bold mt-1 ${gewinn >= 0 ? "text-warm-text" : "text-red-700"}`}>
            {fmtEur(gewinn)}
          </div>
          <div className="text-xs text-warm-muted mt-1">ohne AfA/Privat</div>
        </div>
        <div className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <div className="text-xs text-warm-muted uppercase tracking-wide">Offen</div>
          <div className="text-2xl font-bold text-yellow-700 mt-1">{fmtEur(offenSumme)}</div>
          <div className="text-xs text-warm-muted mt-1">{offenCount} Rechnungen</div>
        </div>
      </div>

      {/* Monatsverlauf */}
      <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
        <h2 className="text-lg font-semibold text-warm-text mb-4">Monatsverlauf {jahr}</h2>
        <div className="space-y-2">
          {monatsVerlauf.map((m) => (
            <div key={m.monat} className="flex items-center gap-3 text-xs">
              <div className="w-8 text-warm-muted">{m.monat}</div>
              <div className="flex-1 grid grid-cols-2 gap-1">
                <div className="bg-green-50 rounded h-6 relative overflow-hidden">
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${(m.ein / maxMonatswert) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end pr-2 text-warm-text font-mono">
                    {m.ein > 0 ? fmtEur(m.ein) : ""}
                  </div>
                </div>
                <div className="bg-red-50 rounded h-6 relative overflow-hidden">
                  <div
                    className="bg-red-400 h-full"
                    style={{ width: `${(m.aus / maxMonatswert) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-end pr-2 text-warm-text font-mono">
                    {m.aus > 0 ? fmtEur(m.aus) : ""}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-warm-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-green-500" /> Einnahmen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-400" /> Ausgaben
          </span>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Einnahmen-Liste */}
        <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-warm-text">Einnahmen ({einnahmen.length})</h2>
            <span className="text-sm text-warm-muted">{fmtEur(summeEinnahmen)}</span>
          </div>
          {einnahmen.length === 0 ? (
            <p className="text-sm text-warm-muted">Keine Einnahmen für {jahr}.</p>
          ) : (
            <ul className="divide-y divide-warm-border text-sm max-h-96 overflow-y-auto">
              {einnahmen
                .slice()
                .sort((a, b) => (b.Datum ?? "").localeCompare(a.Datum ?? ""))
                .map((e) => (
                  <li key={e.id} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-warm-text">{e.Beschreibung || "—"}</div>
                      <div className="text-xs text-warm-muted">
                        {fmtDate(e.Datum)}
                        {e.ELSTER_Zeile_Link?.[0]?.value && (
                          <span className="ml-2">→ {e.ELSTER_Zeile_Link[0].value}</span>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-warm-text shrink-0">{fmtEur(num(e.Betrag_Eur))}</div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Ausgaben-Liste */}
        <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-warm-text">Ausgaben ({ausgaben.length})</h2>
            <span className="text-sm text-warm-muted">{fmtEur(summeAusgaben)}</span>
          </div>
          {ausgaben.length === 0 ? (
            <p className="text-sm text-warm-muted">Keine Ausgaben für {jahr}.</p>
          ) : (
            <ul className="divide-y divide-warm-border text-sm max-h-96 overflow-y-auto">
              {ausgaben
                .slice()
                .sort((a, b) => (b.Datum ?? "").localeCompare(a.Datum ?? ""))
                .map((a) => (
                  <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-warm-text">{a.Beschreibung || "—"}</div>
                      <div className="text-xs text-warm-muted">
                        {fmtDate(a.Datum)} {a.Verkaeufer && `• ${a.Verkaeufer}`}
                        {a.ELSTER_Zeile_Link?.[0]?.value && (
                          <span className="ml-2">→ {a.ELSTER_Zeile_Link[0].value}</span>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-warm-text shrink-0">{fmtEur(num(a.Betrag_Eur))}</div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* Top-Artikel */}
      {topArtikel.length > 0 && (
        <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
          <h2 className="text-lg font-semibold text-warm-text mb-3">Top-Artikel {jahr}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-warm-muted border-b border-warm-border">
                <th className="py-2">Artikel</th>
                <th className="text-right">Anzahl Vermietungen</th>
                <th className="text-right">Umsatz</th>
              </tr>
            </thead>
            <tbody>
              {topArtikel.map((a) => (
                <tr key={a.name} className="border-b border-warm-border/50 last:border-0">
                  <td className="py-2 text-warm-text">{a.name}</td>
                  <td className="text-right text-warm-text">{a.anzahl}</td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(a.umsatz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="text-center">
        <Link
          href={`/admin/elster?jahr=${jahr}`}
          className="inline-block px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dark"
        >
          → ELSTER-EÜR für {jahr} ansehen
        </Link>
      </div>
    </div>
  );
}
