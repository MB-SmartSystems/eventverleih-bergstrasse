/**
 * /admin/rechnungen/[id] — Rechnungs-Detail
 *
 * Aktionen: Als bezahlt markieren, Mahnstufe setzen.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getRow, TABLES } from "@/lib/baserow/client";
import RechnungActionPanel from "./RechnungActionPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Rechnungsdatum: string | null;
  Status: { value: string } | null;
  Typ_Erweitert: { value: string } | null;
  Betrag_Netto: string | null;
  Betrag_USt: string | null;
  Betrag_Gesamt: string | null;
  USt_Satz: string | null;
  Mahnstufe: { value: string } | null;
  Mahn_Datum: string | null;
  Zahlungs_Methode: { value: string } | null;
  Bezahlt_am: string | null;
  Notizen: string | null;
  PDF_URL: string | null;
  Buchung_Link: Array<{ id: number }>;
  Kunde_Link: Array<{ id: number }>;
};

type BuchungRow = { id: number; Buchung_ID: number; Event_datum_von: string | null };
type KundeRow = { id: number; Vorname: string; Nachname: string; Email: string };

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function fmtEur(v: string | null): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function RechnungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { id } = await params;
  const rechnungId = parseInt(id, 10);
  if (!rechnungId) notFound();

  let r: RechnungRow;
  try {
    r = await getRow<RechnungRow>(TABLES.Rechnungen, rechnungId);
  } catch {
    notFound();
  }

  const buchungId = r.Buchung_Link?.[0]?.id;
  const kundeId = r.Kunde_Link?.[0]?.id;
  const [buchung, kunde] = await Promise.all([
    buchungId ? getRow<BuchungRow>(TABLES.Buchungen, buchungId).catch(() => null) : null,
    kundeId ? getRow<KundeRow>(TABLES.Kunden, kundeId).catch(() => null) : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/rechnungen" className="text-sm text-warm-muted hover:text-accent">
          ← Alle Rechnungen
        </Link>
        <h1 className="text-2xl font-bold text-warm-text mt-2">
          <span className="font-mono">{r.Rechnungsnummer}</span>
          <span
            className={
              "ml-3 inline-block px-2 py-1 rounded text-xs font-medium " +
              (r.Status?.value === "Bezahlt" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")
            }
          >
            {r.Status?.value ?? "—"}
          </span>
        </h1>
        <p className="text-sm text-warm-muted mt-1">
          {r.Typ_Erweitert?.value} • Datum {fmtDate(r.Rechnungsdatum)}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Beträge</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 text-warm-muted">Netto</td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(r.Betrag_Netto)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-warm-muted">
                    USt {r.USt_Satz ? `${r.USt_Satz} %` : ""}
                  </td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(r.Betrag_USt)}</td>
                </tr>
                <tr className="border-t border-warm-border">
                  <td className="py-2 text-warm-text font-medium">Gesamt</td>
                  <td className="text-right font-mono text-warm-text font-bold">{fmtEur(r.Betrag_Gesamt)}</td>
                </tr>
              </tbody>
            </table>
            {r.Bezahlt_am && (
              <div className="mt-3 text-xs text-green-700">✓ Bezahlt am {fmtDate(r.Bezahlt_am)} ({r.Zahlungs_Methode?.value ?? "—"})</div>
            )}
            {r.Mahnstufe?.value && r.Mahnstufe.value !== "keine" && (
              <div className="mt-2 text-xs text-red-700">
                ⚠ Mahnstufe {r.Mahnstufe.value} {r.Mahn_Datum && `seit ${fmtDate(r.Mahn_Datum)}`}
              </div>
            )}
          </section>

          {(kunde || buchung) && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Verknüpft</h2>
              <div className="space-y-2 text-sm">
                {kunde && (
                  <Link
                    href={`/admin/kunden/${kunde.id}`}
                    className="block p-3 rounded border border-warm-border hover:bg-accent-50/40"
                  >
                    <div className="text-xs text-warm-muted">Kunde</div>
                    <div className="text-warm-text">
                      {kunde.Vorname} {kunde.Nachname}
                    </div>
                    {kunde.Email && <div className="text-xs text-warm-muted">{kunde.Email}</div>}
                  </Link>
                )}
                {buchung && (
                  <Link
                    href={`/admin/buchungen/${buchung.id}`}
                    className="block p-3 rounded border border-warm-border hover:bg-accent-50/40"
                  >
                    <div className="text-xs text-warm-muted">Buchung</div>
                    <div className="text-warm-text">
                      #{buchung.Buchung_ID} • {fmtDate(buchung.Event_datum_von)}
                    </div>
                  </Link>
                )}
              </div>
            </section>
          )}

          {r.Notizen && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-sm font-semibold text-warm-text mb-2">Notizen</h2>
              <p className="text-xs text-warm-muted whitespace-pre-wrap">{r.Notizen}</p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <RechnungActionPanel
            rechnungId={r.id}
            isPaid={r.Status?.value === "Bezahlt"}
            mahnstufe={r.Mahnstufe?.value ?? "keine"}
          />
          {r.PDF_URL && (
            <a
              href={r.PDF_URL}
              target="_blank"
              rel="noreferrer"
              className="block p-3 rounded-lg bg-warm-surface border border-warm-border text-sm text-warm-text hover:bg-accent-50 text-center"
            >
              📄 PDF öffnen
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
