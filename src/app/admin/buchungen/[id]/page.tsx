/**
 * /admin/buchungen/[id] — Buchungs-Detail
 *
 * Zeigt alle Buchungsdetails + Positionen + Zahlungen + verknüpfte Rechnungen.
 * Aktion: Status updaten (siehe BuchungStatusPanel).
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";
import { getRow, listRows, listAllRows, TABLES } from "@/lib/baserow/client";
import BuchungStatusPanel from "./BuchungStatusPanel";
import BuchungChecklist from "./BuchungChecklist";
import TerminePanel from "./TerminePanel";
import KautionErstattenPanel from "./KautionErstattenPanel";
import RechnungErstellenButton from "./RechnungErstellenButton";
import ZahlungsPanel from "./ZahlungsPanel";
import UebergabeDialog from "./UebergabeDialog";
import RuecknahmeDialog from "./RuecknahmeDialog";
import StornoDialog from "./StornoDialog";
import StripeLinksPanel from "./StripeLinksPanel";
import KautionMailPanel from "./KautionMailPanel";
import { loadEveSettings, calculateStornoErstattung } from "@/lib/eventverleih/settings";
import { bezahltEur } from "@/lib/eventverleih/zahlung";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Status_Erweitert: { value: string } | null;
  Standort_Typ: { value: string } | null;
  Standort_Bestaetigt: boolean;
  Helfer_Bestaetigt: boolean;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution: string | null;
  Gesamt: string | null;
  Lieferadresse: string | null;
  Aufbau_gewuenscht: { value: string } | null;
  Abbau_gewuenscht: { value: string } | null;
  Notizen: string | null;
  Anzahlung_Soll_Eur: string | null;
  Anzahlung_Bezahlt_am: string | null;
  Anzahlung_Bezahlt_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Restzahlung_Bezahlt_am: string | null;
  Restzahlung_Bezahlt_Eur: string | null;
  Kaution_Soll_Eur: string | null;
  Zahlungen_JSON: string | null;
  Checklist_State_JSON: string | null;
  Akzeptiert_am?: string | null;
  Uebergabe_Termin?: string | null;
  Rueckgabe_Termin?: string | null;
  Calendar_Event_ID_Uebergabe?: string | null;
  Calendar_Event_ID_Rueckgabe?: string | null;
  Kaution_Pruefung_Status?: { value: string } | string | null;
  Kaution_Prueffrist_bis?: string | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_Eur: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Storno_am: string | null;
  Storno_Stufe: { value: string } | null;
  Storno_Betrag_Eur: string | null;
  Schaden_Betrag_Eur: string | null;
  Token_Angebot: string | null;
  Token_Vertrag: string | null;
  Buchung_Quelle: { value: string } | null;
  Kunde_Link: Array<{ id: number; value: string }>;
  Stripe_Kaution_PaymentIntent: string | null;
  Stripe_Anzahlung_Link: string | null;
  Stripe_Restzahlung_Link: string | null;
  Stripe_Kaution_Link: string | null;
  Uebergabe_Adresse: string | null;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_Hausnr?: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};

type PositionRow = {
  id: number;
  Anzahl: string;
  Einzelpreis_Eur: string;
  Position_Gesamt_Eur: string;
  Artikel_Link: Array<{ id: number; value: string }>;
  Buchung_Link: Array<{ id: number }>;
  Eingepackt?: boolean | null;
};

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Typ_Erweitert: { value: string } | null;
  Status: { value: string } | null;
  Betrag_Gesamt: string | null;
  Rechnungsdatum: string | null;
  Buchung_Link: Array<{ id: number }>;
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("de-DE");
}

function fmtEur(v: string | null): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

export default async function BuchungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/admin");
  const { id } = await params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) notFound();

  let buchung: BuchungRow;
  try {
    buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);
  } catch {
    notFound();
  }

  const kundeId = buchung.Kunde_Link?.[0]?.id;
  const kunde = kundeId ? await getRow<KundeRow>(TABLES.Kunden, kundeId).catch(() => null) : null;

  const [positionenAll, rechnungenAll, artikelAll, angeboteAll, mailsAll] = await Promise.all([
    listAllRows<PositionRow>(TABLES.Buchungs_Position),
    listAllRows<RechnungRow>(TABLES.Rechnungen),
    listAllRows<{ id: number; Bezeichnung: string }>(TABLES.Artikel),
    listAllRows<{ id: number; Anfragedatum: string | null; Angebotsdatum: string | null; Akzeptiert_am: string | null; Buchung_Link: Array<{ id: number }> }>(TABLES.Angebote),
    listAllRows<{
      id: number;
      Subject: string | null;
      Body: string | null;
      Template_Key: string | null;
      Erstellt_am: string | null;
      Sent_am: string | null;
      Approval_Status: { value: string } | string | null;
      Buchung_Link: Array<{ id: number }>;
    }>(TABLES.MailQueue),
  ]);
  const positionen = positionenAll.results.filter((p) => p.Buchung_Link?.[0]?.id === buchungId);
  const rechnungen = rechnungenAll.results.filter((r) => r.Buchung_Link?.[0]?.id === buchungId);
  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  const angebot = angeboteAll.results.find((a) => a.Buchung_Link?.[0]?.id === buchungId) ?? null;
  const mails = mailsAll.results
    .filter((m) => m.Buchung_Link?.[0]?.id === buchungId)
    .sort((a, b) => (b.Sent_am || b.Erstellt_am || "").localeCompare(a.Sent_am || a.Erstellt_am || ""));

  const status = buchung.Status_Erweitert?.value ?? "Anfrage";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin/buchungen" className="text-sm text-warm-muted hover:text-accent">
            ← Alle Buchungen
          </Link>
          <h1 className="text-2xl font-bold text-warm-text mt-2">
            {status === "Anfrage" ? "Anfrage" : ["Angebot_erstellt", "Angebot_versendet"].includes(status) ? "Angebot" : "Buchung"} #{buchung.Buchung_ID}
            <span className="ml-3 inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
              {status.replace(/_/g, " ")}
            </span>
          </h1>
          <p className="text-sm text-warm-muted mt-1">Event: {fmtDate(buchung.Event_datum_von)}</p>
        </div>
        <div className="flex gap-2">
          {buchung.Token_Angebot && (
            <a
              href={`https://eventverleih-bergstrasse.de/angebot/${buchung.Token_Angebot}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-2 rounded bg-warm-surface border border-warm-border hover:bg-accent-50"
            >
Angebot
            </a>
          )}
          {buchung.Token_Vertrag && (
            <a
              href={`https://eventverleih-bergstrasse.de/vertrag/${buchung.Token_Vertrag}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-2 rounded bg-warm-surface border border-warm-border hover:bg-accent-50"
            >
Vertrag
            </a>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Kunde */}
          {kunde && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Kunde</h2>
              <div className="text-sm space-y-1">
                <div className="text-warm-text font-medium">
                  <Link href={`/admin/kunden/${kunde.id}`} className="hover:text-accent">
                    {kunde.Vorname} {kunde.Nachname}
                  </Link>
                </div>
                {kunde.Email && (
                  <a href={`mailto:${kunde.Email}`} className="text-warm-muted hover:text-accent block">
                    {kunde.Email}
                  </a>
                )}
                {kunde.Telefon && (
                  <a href={`tel:${kunde.Telefon}`} className="text-warm-muted hover:text-accent block">
                    {kunde.Telefon}
                  </a>
                )}
                {kunde.Adresse_Strasse && (
                  <div className="text-warm-muted mt-2">
                    {kunde.Adresse_Strasse}, {kunde.Adresse_PLZ} {kunde.Adresse_Ort}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Artikel */}
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Artikel ({positionen.length})</h2>
            {positionen.length === 0 ? (
              <p className="text-sm text-warm-muted">Keine Artikel-Positionen.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-warm-muted border-b border-warm-border">
                    <th className="py-2">Artikel</th>
                    <th className="text-right">Anzahl</th>
                    <th className="text-right">Einzel</th>
                    <th className="text-right">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.map((p) => {
                    const aid = p.Artikel_Link?.[0]?.id;
                    const name = aid ? artikelNameById.get(aid) ?? `Artikel ${aid}` : "—";
                    return (
                    <tr key={p.id} className="border-b border-warm-border/50 last:border-0">
                      <td className="py-2 text-warm-text">{name}</td>
                      <td className="text-right text-warm-text">{p.Anzahl}</td>
                      <td className="text-right text-warm-muted">{fmtEur(p.Einzelpreis_Eur)}</td>
                      <td className="text-right text-warm-text font-medium">{fmtEur(p.Position_Gesamt_Eur)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {/* Gebuchte Services — sichtbar direkt unter der Artikelliste */}
            {(() => {
              const services = [
                { label: "Lieferung", val: parseFloat(buchung.Preis_Lieferung || "0") || 0 },
                { label: "Abholung", val: parseFloat(buchung.Preis_Abholung || "0") || 0 },
                { label: "Aufbau-Service", val: parseFloat(buchung.Preis_Aufbau || "0") || 0 },
              ].filter((s) => s.val > 0);
              if (services.length === 0) return null;
              return (
                <div className="mt-4 pt-3 border-t border-warm-border">
                  <p className="text-xs uppercase tracking-wide text-warm-muted mb-2">Zusätzlich gebucht</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {services.map((s) => (
                        <tr key={s.label} className="border-b border-warm-border/50 last:border-0">
                          <td className="py-2 text-warm-text">{s.label}</td>
                          <td className="text-right text-warm-text font-medium">{fmtEur(s.val.toFixed(2))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>

          {/* Notizen */}
          {buchung.Notizen && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Notizen</h2>
              <p className="text-sm text-warm-muted whitespace-pre-wrap">{buchung.Notizen}</p>
            </section>
          )}

          {/* Rechnungen */}
          {rechnungen.length > 0 && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              <h2 className="text-lg font-semibold text-warm-text mb-3">Rechnungen ({rechnungen.length})</h2>
              <div className="space-y-2">
                {rechnungen.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/rechnungen/${r.id}`}
                    className="block p-3 rounded-lg border border-warm-border hover:bg-accent-50/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm">
                        <span className="font-mono text-warm-text">{r.Rechnungsnummer}</span>
                        {r.Typ_Erweitert?.value && (
                          <span className="ml-2 text-xs text-warm-muted">{r.Typ_Erweitert.value}</span>
                        )}
                      </div>
                      <div className="text-sm text-warm-text font-medium">{fmtEur(r.Betrag_Gesamt)}</div>
                      <span className="text-xs text-warm-muted">{r.Status?.value ?? "—"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Schriftverkehr — alle E-Mails an den Kunden (MailQueue) */}
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Schriftverkehr ({mails.length})</h2>
            {mails.length === 0 ? (
              <p className="text-sm text-warm-muted">Noch keine E-Mails zu dieser Buchung.</p>
            ) : (() => {
              const renderMail = (m: (typeof mails)[number]) => {
                const st =
                  typeof m.Approval_Status === "object" && m.Approval_Status
                    ? m.Approval_Status.value
                    : (m.Approval_Status as string | null);
                const statusText = m.Sent_am
                  ? `✓ gesendet ${fmtDate(m.Sent_am)}`
                  : st === "Auto_Reply" || st === "Approved"
                    ? "wird versendet…"
                    : st || "offen";
                return (
                  <details key={m.id} className="rounded-lg border border-warm-border bg-warm-bg/40">
                    <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-sm text-warm-text font-medium">{m.Subject || "(kein Betreff)"}</span>
                      <span className="text-xs text-warm-muted whitespace-nowrap">{statusText}</span>
                    </summary>
                    <div className="px-3 pb-3 pt-1 border-t border-warm-border">
                      <pre className="whitespace-pre-wrap break-words text-xs text-warm-muted font-sans leading-relaxed">{m.Body || "(kein Inhalt)"}</pre>
                    </div>
                  </details>
                );
              };
              return (
                <div className="space-y-2">
                  {mails.slice(0, 5).map(renderMail)}
                  {mails.length > 5 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-sm text-warm-muted hover:text-warm-text px-1 py-1">
                        Alle {mails.length} E-Mails anzeigen
                      </summary>
                      <div className="space-y-2 mt-2">{mails.slice(5).map(renderMail)}</div>
                    </details>
                  )}
                </div>
              );
            })()}
          </section>
        </div>

        <div className="space-y-6">
          {/* Zahlungen (Preis-Breakdown + Bezahlt/Offen + Historie zusammengeführt) */}
          {(() => {
            const gesamt =
              (parseFloat(buchung.Preis_Artikel ?? "0") || 0) +
              (parseFloat(buchung.Preis_Lieferung ?? "0") || 0) +
              (parseFloat(buchung.Preis_Abholung ?? "0") || 0) +
              (parseFloat(buchung.Preis_Aufbau ?? "0") || 0);
            const zahlungen: Array<{ datum: string; typ: string; betrag: number; methode: string }> = (() => {
              try {
                if (!buchung.Zahlungen_JSON) return [];
                const p = JSON.parse(buchung.Zahlungen_JSON);
                return Array.isArray(p) ? p : [];
              } catch {
                return [];
              }
            })();
            // Bezahlt aus den Skalar-Feldern (Source of Truth) — die schreiben BEIDE
            // Wege: manuelle Erfassung UND Stripe-Webhook. Zahlungen_JSON fuellt nur
            // der manuelle Weg, war daher bei Stripe-Zahlungen leer -> "Offen" falsch.
            const bezahlt =
              (parseFloat(buchung.Anzahlung_Bezahlt_Eur ?? "0") || 0) +
              (parseFloat(buchung.Restzahlung_Bezahlt_Eur ?? "0") || 0);
            const offen = Math.max(0, gesamt - bezahlt);
            return (
          <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
            <h2 className="text-lg font-semibold text-warm-text mb-3">Zahlungen</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1.5 text-warm-muted">Mietsumme (Artikel)</td>
                  <td className="text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Artikel)}</td>
                </tr>
                {(parseFloat(buchung.Preis_Lieferung || "0") || 0) > 0 && (
                  <tr>
                    <td className="py-1.5 text-warm-muted">Lieferung</td>
                    <td className="text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Lieferung)}</td>
                  </tr>
                )}
                {(parseFloat(buchung.Preis_Abholung || "0") || 0) > 0 && (
                  <tr>
                    <td className="py-1.5 text-warm-muted">Abholung</td>
                    <td className="text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Abholung)}</td>
                  </tr>
                )}
                {(parseFloat(buchung.Preis_Aufbau || "0") || 0) > 0 && (
                  <tr>
                    <td className="py-1.5 text-warm-muted">Aufbau</td>
                    <td className="text-right font-mono text-warm-text">{fmtEur(buchung.Preis_Aufbau)}</td>
                  </tr>
                )}
                <tr className="border-t border-warm-border font-semibold">
                  <td className="py-1.5 text-warm-text">Gesamt</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(
                      (
                        (parseFloat(buchung.Preis_Artikel || "0") || 0) +
                        (parseFloat(buchung.Preis_Lieferung || "0") || 0) +
                        (parseFloat(buchung.Preis_Abholung || "0") || 0) +
                        (parseFloat(buchung.Preis_Aufbau || "0") || 0)
                      ).toFixed(2),
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-warm-muted">Anzahlung (30 %)</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(buchung.Anzahlung_Soll_Eur)}
                    {buchung.Anzahlung_Bezahlt_am && (
                      <span className="text-xs text-green-600 block">✓ {fmtDate(buchung.Anzahlung_Bezahlt_am)}</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-warm-muted">Restzahlung (70 %)</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(buchung.Restzahlung_Soll_Eur)}
                    {buchung.Restzahlung_Bezahlt_am && (
                      <span className="text-xs text-green-600 block">✓ {fmtDate(buchung.Restzahlung_Bezahlt_am)}</span>
                    )}
                  </td>
                </tr>
                <tr className="border-t border-warm-border">
                  <td className="py-1.5 text-warm-muted">Kaution</td>
                  <td className="text-right font-mono text-warm-text">
                    {fmtEur(buchung.Kaution_Soll_Eur)}
                    {buchung.Kaution_Hinterlegt_am && (
                      <span className="text-xs text-blue-600 block">↘ {fmtDate(buchung.Kaution_Hinterlegt_am)}</span>
                    )}
                    {buchung.Kaution_Rueckzahlung_am && (
                      <span className="text-xs text-green-600 block">↗ {fmtDate(buchung.Kaution_Rueckzahlung_am)}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-3 text-center border-t border-warm-border mt-3 pt-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-warm-muted">Bezahlt</div>
                <div className={`text-lg font-semibold mt-1 ${bezahlt >= gesamt ? "text-green-700" : "text-warm-text"}`}>{bezahlt.toFixed(2)} €</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-warm-muted">Offen</div>
                <div className={`text-lg font-semibold mt-1 ${offen === 0 ? "text-green-700" : "text-amber-700"}`}>{offen.toFixed(2)} €</div>
              </div>
            </div>
            {zahlungen.length > 0 && (
              <div className="text-xs text-warm-muted border-t border-warm-border pt-2 mt-3 space-y-1">
                {zahlungen.map((z, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-warm-text">{new Date(z.datum).toLocaleDateString("de-DE")}</span>
                    <span className="capitalize">{z.typ}</span>
                    <span>·</span>
                    <span>{z.methode}</span>
                    <span className="ml-auto font-medium">{z.betrag.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
          </section>
            );
          })()}

          {/* Checkliste — UI-Helfer fuer Manuel */}
          {(() => {
            const checklistState: Record<string, { checked: boolean; ts: string }> = (() => {
              try {
                if (!buchung.Checklist_State_JSON) return {};
                const p = JSON.parse(buchung.Checklist_State_JSON);
                return p && typeof p === "object" ? p : {};
              } catch { return {}; }
            })();

            // Auto-Items basierend auf Buchungs-Daten
            const autoItems = [
              {
                key: "angebot_versendet",
                phase: "Angebot",
                label: "Angebot freigegeben + Mail raus",
                checked: ["Angebot_versendet", "Bestaetigt", "Reserviert", "Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"].includes(status),
              },
              {
                key: "kunde_bestaetigt",
                phase: "Angebot",
                label: "Kunde hat Angebot bestätigt",
                checked: ["Bestaetigt", "Reserviert", "Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"].includes(status),
                meta: buchung.Akzeptiert_am ? new Date(buchung.Akzeptiert_am).toLocaleDateString("de-DE") : undefined,
              },
              {
                key: "anzahlung",
                phase: "Zahlung",
                label: "Anzahlung eingegangen",
                checked: !!buchung.Anzahlung_Bezahlt_am,
                meta: buchung.Anzahlung_Bezahlt_am ? new Date(buchung.Anzahlung_Bezahlt_am).toLocaleDateString("de-DE") : undefined,
              },
              {
                key: "restzahlung",
                phase: "Zahlung",
                label: "Restzahlung eingegangen",
                checked: !!buchung.Restzahlung_Bezahlt_am,
                meta: buchung.Restzahlung_Bezahlt_am ? new Date(buchung.Restzahlung_Bezahlt_am).toLocaleDateString("de-DE") : undefined,
              },
              {
                key: "uebergabe",
                phase: "Übergabe",
                label: "Übergabe durchgeführt",
                checked: ["Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"].includes(status),
              },
              {
                key: "rueckgabe",
                phase: "Rückgabe",
                label: "Rückgabe durchgeführt",
                checked: ["Zurueckgegeben", "Abgerechnet"].includes(status),
              },
              {
                key: "kaution_aufgeloest",
                phase: "Rückgabe",
                label: "Kaution aufgelöst (zurück oder einbehalten)",
                checked: !!buchung.Kaution_Rueckzahlung_am,
                meta: buchung.Kaution_Rueckzahlung_am ? new Date(buchung.Kaution_Rueckzahlung_am).toLocaleDateString("de-DE") : undefined,
              },
              {
                key: "abgerechnet",
                phase: "Abrechnung",
                label: "Rechnung erstellt + Mail raus",
                checked: status === "Abgerechnet",
              },
            ];

            // Manuelle Items (Phase steuert Gruppierung in der Checkliste)
            const manualItemKeys = [
              { key: "uebergabe_termin", phase: "Übergabe", label: "Übergabe-Termin telefonisch abgestimmt" },
              { key: "schaden_geprueft", phase: "Rückgabe", label: "Schäden geprüft + ggf. dokumentiert" },
            ];
            const manualItems = manualItemKeys.map((m) => ({
              ...m,
              checked: checklistState[m.key]?.checked ?? false,
            }));

            // Pack-Items aus Buchungs_Position
            const packItems = positionen.map((p) => {
              const aid = p.Artikel_Link?.[0]?.id;
              const name = aid ? artikelNameById.get(aid) ?? `Artikel ${aid}` : "Artikel";
              const anzahl = parseFloat(p.Anzahl ?? "1");
              return {
                positionId: p.id,
                label: `${anzahl}× ${name}`,
                checked: !!p.Eingepackt,
              };
            });

            return (
              <BuchungChecklist
                buchungId={buchung.id}
                autoItems={autoItems}
                manualItems={manualItems}
                packItems={packItems}
              />
            );
          })()}

          {/* Zahlungseingang erfassen */}
          <ZahlungsPanel
            buchungId={buchung.id}
            anzahlungBezahlt={buchung.Anzahlung_Bezahlt_am}
            restzahlungBezahlt={buchung.Restzahlung_Bezahlt_am}
            kautionHinterlegt={buchung.Kaution_Hinterlegt_am}
            anzahlungSollEur={parseFloat(buchung.Anzahlung_Soll_Eur ?? "0") || 0}
            restzahlungSollEur={parseFloat(buchung.Restzahlung_Soll_Eur ?? "0") || 0}
            kautionSollEur={parseFloat(buchung.Kaution_Soll_Eur ?? "0") || 0}
            zahlungen={(() => {
              try {
                if (!buchung.Zahlungen_JSON) return [];
                const p = JSON.parse(buchung.Zahlungen_JSON);
                return Array.isArray(p) ? p : [];
              } catch { return []; }
            })()}
          />

          {/* Stripe-Zahlungslinks */}
          {/* Manuelle Zahlungs-Tools — eingeklappt (Links liegen automatisch in
              Angebot/Mein-Bereich/Mails; hier nur fuer manuelles Nachsenden). */}
          <details>
            <summary className="cursor-pointer text-sm text-warm-muted hover:text-warm-text px-1 py-2">
              Zahlungs-Links & Kaution-Mail (manuell)
            </summary>
            <div className="mt-2 space-y-4">
              <StripeLinksPanel
                buchungId={buchung.id}
                anzahlungSollEur={parseFloat(buchung.Anzahlung_Soll_Eur ?? "0")}
                restzahlungSollEur={parseFloat(buchung.Restzahlung_Soll_Eur ?? "0")}
                anzahlungLink={buchung.Stripe_Anzahlung_Link}
                restzahlungLink={buchung.Stripe_Restzahlung_Link}
                anzahlungBezahlt={!!buchung.Anzahlung_Bezahlt_am}
                restzahlungBezahlt={!!buchung.Restzahlung_Bezahlt_am}
              />
              <KautionMailPanel
                buchungId={buchung.id}
                kautionSollEur={parseFloat(buchung.Kaution_Soll_Eur ?? "0")}
                kautionLink={buchung.Stripe_Kaution_Link}
                kautionHinterlegtAm={buchung.Kaution_Hinterlegt_am}
              />
            </div>
          </details>

          {/* Termine (Uebergabe + Rueckgabe) — wird in Google Calendar synct wenn ENV gesetzt */}
          <TerminePanel
            buchungId={buchung.id}
            uebergabeInitial={buchung.Uebergabe_Termin ?? null}
            rueckgabeInitial={buchung.Rueckgabe_Termin ?? null}
            calendarIdUebergabe={buchung.Calendar_Event_ID_Uebergabe ?? null}
            calendarIdRueckgabe={buchung.Calendar_Event_ID_Rueckgabe ?? null}
          />

          {/* Kaution-Pruefphase: wird nach Rueckgabe sichtbar wenn Kaution offen */}
          {status === "Zurueckgegeben" &&
           !buchung.Kaution_Rueckzahlung_am &&
           parseFloat(buchung.Kaution_Soll_Eur ?? "0") > 0 && (
            <KautionErstattenPanel
              buchungId={buchung.id}
              kautionSollEur={parseFloat(buchung.Kaution_Soll_Eur ?? "0")}
              prueffristBis={buchung.Kaution_Prueffrist_bis ?? null}
              hasStripeHold={!!buchung.Stripe_Kaution_PaymentIntent}
            />
          )}

          {/* Status-Aktionen — eingeklappt (Status wird normalerweise automatisch gesetzt) */}
          <details>
            <summary className="cursor-pointer text-sm text-warm-muted hover:text-warm-text px-1 py-2">
              Status manuell setzen (Notfall)
            </summary>
            <div className="mt-2">
              <BuchungStatusPanel buchungId={buchung.id} currentStatus={status} />
            </div>
          </details>

          {/* Übergabe / Rückgabe / Storno — context-abhängig */}
          {(status === "Reserviert" || status === "Bestaetigt") && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
              <h2 className="text-lg font-semibold text-warm-text">Übergabe</h2>
              <UebergabeDialog
                buchungId={buchung.id}
                positionen={positionen.map((p) => ({
                  id: p.id,
                  name: artikelNameById.get(p.Artikel_Link?.[0]?.id ?? 0) ?? "Artikel",
                  anzahl: parseFloat(p.Anzahl ?? "1"),
                }))}
                uebergabeAdresse={buchung.Uebergabe_Adresse ?? buchung.Lieferadresse ?? undefined}
                kautionSollEur={parseFloat(buchung.Kaution_Soll_Eur ?? "0") || undefined}
              />
            </section>
          )}
          {(status === "Uebergeben" || status === "In_Miete") && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border space-y-3">
              <h2 className="text-lg font-semibold text-warm-text">Rückgabe</h2>
              <RuecknahmeDialog
                buchungId={buchung.id}
                positionen={positionen.map((p) => ({
                  id: p.id,
                  name: artikelNameById.get(p.Artikel_Link?.[0]?.id ?? 0) ?? "Artikel",
                  anzahl: parseFloat(p.Anzahl ?? "1"),
                }))}
                hasKautionPreAuth={!!buchung.Stripe_Kaution_PaymentIntent}
                kautionSollEur={parseFloat(buchung.Kaution_Soll_Eur ?? "0") || undefined}
              />
            </section>
          )}

          {/* Übergabe-/Rücknahmeprotokoll als PDF (sobald Übergabe dokumentiert) */}
          {["Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"].includes(status) && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-warm-text">Protokoll</h2>
                <p className="text-sm text-warm-muted">Digitale Übergabe-/Rücknahmedokumentation (Checkliste, Fotos, Schäden, Kaution).</p>
              </div>
              <a
                href={`/protokoll/${buchung.id}/print`}
                target="_blank"
                rel="noopener"
                className="px-4 py-2 rounded-lg border border-warm-border text-warm-text text-sm font-medium hover:bg-warm-bg/60 whitespace-nowrap"
              >
                Protokoll ansehen
              </a>
            </section>
          )}

          {/* Storno (nur bei aktiven Buchungen) */}
          {!["Storniert", "Abgerechnet", "Zurueckgegeben"].includes(status) && (
            <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
              {(async () => {
                const settings = await loadEveSettings();
                // Tatsaechlich bezahlt (Skalar-Felder), NICHT Soll — sonst wird die
                // Erstattung ueberzahlt, wenn der Kunde erst die Anzahlung geleistet hat.
                const bezahlt = bezahltEur(buchung);
                const calc = calculateStornoErstattung(
                  buchung.Event_datum_von,
                  bezahlt,
                  settings,
                );
                return (
                  <StornoDialog
                    buchungId={buchung.id}
                    eventDatum={buchung.Event_datum_von}
                    bezahltEur={bezahlt}
                    stripeIntentId={buchung.Stripe_Kaution_PaymentIntent ?? undefined}
                    defaultErstattungEur={calc.erstattung_eur}
                    tageBisEvent={calc.tage_bis_event}
                    quote={calc.quote}
                  />
                );
              })()}
            </section>
          )}

          {/* Rechnung erstellen */}
          <RechnungErstellenButton
            buchungId={buchung.id}
            hasPrice={parseFloat(buchung.Preis_Artikel ?? "0") > 0}
            alreadyHasRechnung={rechnungen.length > 0}
          />

          {/* Meta — eingeklappt (Details bei Bedarf) */}
          <details className="rounded-xl bg-warm-surface border border-warm-border">
            <summary className="cursor-pointer px-5 py-3 text-sm text-warm-muted hover:text-warm-text">
              Details (Quelle, Standort, Aufbau)
            </summary>
            <div className="px-5 pb-5 text-xs space-y-1 text-warm-muted">
              <div>Quelle: {buchung.Buchung_Quelle?.value ?? "—"}</div>
              <div>Standort: {buchung.Standort_Typ?.value?.replace(/_/g, " ") ?? "—"}</div>
              {buchung.Aufbau_gewuenscht?.value === "Ja" && <div>✓ Aufbau gewünscht</div>}
              {buchung.Abbau_gewuenscht?.value === "Ja" && <div>✓ Abbau gewünscht</div>}
              {buchung.Lieferadresse && <div>Lieferung: {buchung.Lieferadresse}</div>}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
