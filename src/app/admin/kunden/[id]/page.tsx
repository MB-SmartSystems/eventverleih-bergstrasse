/**
 * /admin/kunden/[id] — Kunde-Detail mit verknüpften Buchungen + Rechnungen
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KundeRow = {
  id: number;
  Kunde_ID: number;
  Kunde_Typ: { value: string } | null;
  Vorname: string;
  Nachname: string;
  Firma: string;
  Email: string;
  Telefon: string;
  WhatsApp: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
  Distanz_km: string;
  Notizen: string;
  Bevorzugter_Kanal: { value: string } | null;
  Einwilligung_Kontakt: { value: string } | null;
  Stammkunde_Wertung: { value: string } | null;
  Erstanfrage_am: string | null;
  Letzter_Kontakt_am: string | null;
};

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Status_Erweitert: { value: string } | null;
  Preis_Artikel: string | null;
  Kunde_Link: Array<{ id: number }>;
};

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Rechnungsdatum: string | null;
  Status: { value: string } | null;
  Typ_Erweitert: { value: string } | null;
  Betrag_Gesamt: string | null;
  Kunde_Link: Array<{ id: number }>;
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

export default async function KundeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { id } = await params;
  const kundeId = parseInt(id, 10);
  if (!kundeId) notFound();

  let kunde: KundeRow;
  try {
    kunde = await getRow<KundeRow>(TABLES.Kunden, kundeId);
  } catch {
    notFound();
  }

  const [buchungenAll, rechnungenAll] = await Promise.all([
    listRows<BuchungRow>(TABLES.Buchungen, { size: 500 }),
    listRows<RechnungRow>(TABLES.Rechnungen, { size: 500 }),
  ]);
  const buchungen = buchungenAll.results
    .filter((b) => b.Kunde_Link?.[0]?.id === kundeId)
    .sort((a, b) => (b.Event_datum_von ?? "").localeCompare(a.Event_datum_von ?? ""));
  const rechnungen = rechnungenAll.results
    .filter((r) => r.Kunde_Link?.[0]?.id === kundeId)
    .sort((a, b) => (b.Rechnungsdatum ?? "").localeCompare(a.Rechnungsdatum ?? ""));

  const umsatzGesamt = rechnungen
    .filter((r) => r.Status?.value === "Bezahlt")
    .reduce((s, r) => s + (parseFloat(r.Betrag_Gesamt ?? "0") || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/kunden" className="text-sm text-warm-muted hover:text-accent">
          ← Alle Kunden
        </Link>
        <h1 className="text-2xl font-bold text-warm-text mt-2">
          {kunde.Vorname} {kunde.Nachname}
          <span className="ml-3 text-sm text-warm-muted font-normal">#{kunde.Kunde_ID}</span>
        </h1>
        {kunde.Firma && <p className="text-sm text-warm-muted mt-1">{kunde.Firma}</p>}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Kontakt</h2>
            <div className="space-y-1.5 text-sm">
              {kunde.Email && (
                <a href={`mailto:${kunde.Email}`} className="text-warm-muted hover:text-accent block">
                  📧 {kunde.Email}
                </a>
              )}
              {kunde.Telefon && (
                <a href={`tel:${kunde.Telefon}`} className="text-warm-muted hover:text-accent block">
                  📞 {kunde.Telefon}
                </a>
              )}
              {kunde.WhatsApp && (
                <a
                  href={`https://wa.me/${kunde.WhatsApp.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-warm-muted hover:text-accent block"
                >
                  💬 {kunde.WhatsApp}
                </a>
              )}
              {kunde.Adresse_Strasse && (
                <div className="text-warm-muted mt-2 pt-2 border-t border-warm-border">
                  {kunde.Adresse_Strasse}
                  <br />
                  {kunde.Adresse_PLZ} {kunde.Adresse_Ort}
                  {kunde.Distanz_km && <div className="text-xs">{kunde.Distanz_km} km entfernt</div>}
                </div>
              )}
            </div>
          </section>

          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border text-xs space-y-1.5 text-warm-muted">
            <div>Typ: {kunde.Kunde_Typ?.value ?? "—"}</div>
            {kunde.Stammkunde_Wertung?.value && <div>Wertung: {kunde.Stammkunde_Wertung.value}</div>}
            {kunde.Bevorzugter_Kanal?.value && <div>Bevorzugt: {kunde.Bevorzugter_Kanal.value}</div>}
            <div>Erstanfrage: {fmtDate(kunde.Erstanfrage_am)}</div>
            <div>Letzter Kontakt: {fmtDate(kunde.Letzter_Kontakt_am)}</div>
            <div className="pt-2 border-t border-warm-border text-warm-text font-medium">
              Umsatz (bezahlt): {umsatzGesamt.toFixed(2).replace(".", ",")} €
            </div>
          </section>

          {kunde.Notizen && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-sm font-semibold text-warm-text mb-2">Notizen</h2>
              <p className="text-xs text-warm-muted whitespace-pre-wrap">{kunde.Notizen}</p>
            </section>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Buchungen ({buchungen.length})</h2>
            {buchungen.length === 0 ? (
              <p className="text-sm text-warm-muted">Noch keine Buchungen.</p>
            ) : (
              <div className="space-y-2">
                {buchungen.map((b) => (
                  <Link
                    key={b.id}
                    href={`/admin/buchungen/${b.id}`}
                    className="block p-3 rounded-lg border border-warm-border hover:bg-accent-50/40"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
                      <div>
                        <span className="font-mono text-xs text-warm-muted">#{b.Buchung_ID}</span>
                        <span className="ml-2 text-warm-text">{fmtDate(b.Event_datum_von)}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        {b.Status_Erweitert?.value?.replace(/_/g, " ") ?? "—"}
                      </span>
                      <span className="font-mono text-warm-text">{fmtEur(b.Preis_Artikel)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Rechnungen ({rechnungen.length})</h2>
            {rechnungen.length === 0 ? (
              <p className="text-sm text-warm-muted">Noch keine Rechnungen.</p>
            ) : (
              <div className="space-y-2">
                {rechnungen.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/rechnungen/${r.id}`}
                    className="block p-3 rounded-lg border border-warm-border hover:bg-accent-50/40"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
                      <div>
                        <span className="font-mono text-xs text-warm-text">{r.Rechnungsnummer}</span>
                        {r.Typ_Erweitert?.value && (
                          <span className="ml-2 text-xs text-warm-muted">{r.Typ_Erweitert.value}</span>
                        )}
                      </div>
                      <span className="text-xs text-warm-muted">{fmtDate(r.Rechnungsdatum)}</span>
                      <span
                        className={
                          "text-xs px-2 py-0.5 rounded " +
                          (r.Status?.value === "Bezahlt"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700")
                        }
                      >
                        {r.Status?.value ?? "—"}
                      </span>
                      <span className="font-mono text-warm-text">{fmtEur(r.Betrag_Gesamt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
