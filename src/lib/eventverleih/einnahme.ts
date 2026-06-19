/**
 * Einnahme-Buchung nach dem Zuflussprinzip (Modell A).
 *
 * Eine Einnahme (für Finanzen-Reiter + ELSTER-EÜR) entsteht im Moment des
 * Geldzuflusses — beim Zahlungseingang (Stripe-Webhook oder manuelle Erfassung),
 * NICHT erst bei Rechnungserstellung. Das entspricht dem steuerlichen
 * Zuflussprinzip (§ 11 EStG) und macht den Finanzen-Reiter unabhängig davon,
 * ob/wann eine Rechnung erstellt wird.
 *
 * Idempotenz über einen stabilen Marker `[evt:B<buchungId>:<quelle>]` in `Notizen`:
 * derselbe Zahlungseingang (gleiche Stripe-PaymentIntent-ID bzw. gleicher manueller
 * Eintrag) wird nie doppelt gebucht — auch nicht bei Webhook-Re-Delivery.
 *
 * Kaution wird NICHT als Einnahme gebucht (Pre-Auth-Hold = kein Zufluss).
 *
 * Fail-soft: ein Fehler hier darf den Zahlungs-/Webhook-Pfad nicht in einen 500 kippen.
 */
import { createRow, listAllRows, TABLES } from "@/lib/baserow/client";

const MARKER_PREFIX = "evt:B";

export function einnahmeMarker(buchungId: number, quelle: string): string {
  return `[${MARKER_PREFIX}${buchungId}:${quelle}]`;
}

type EinnahmeNotizRow = { Notizen?: string | null; Betrag_Eur?: string | number | null };

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/** Hat die Buchung bereits eine Zufluss-Einnahme (egal welche Quelle)? */
export async function bookingHatEinnahme(buchungId: number): Promise<boolean> {
  const prefix = `[${MARKER_PREFIX}${buchungId}:`;
  try {
    const res = await listAllRows<EinnahmeNotizRow>(TABLES.Einnahmen);
    return res.results.some((e) => (e.Notizen || "").includes(prefix));
  } catch (e) {
    console.error("[einnahme] bookingHatEinnahme fehlgeschlagen:", e);
    return false;
  }
}

/** Summe aller bereits gebuchten Zufluss-Einnahmen einer Buchung (über den Marker). */
export async function gebuchteEinnahmenSumme(buchungId: number): Promise<number> {
  const prefix = `[${MARKER_PREFIX}${buchungId}:`;
  try {
    const res = await listAllRows<EinnahmeNotizRow>(TABLES.Einnahmen);
    return res.results
      .filter((e) => (e.Notizen || "").includes(prefix))
      .reduce((s, e) => s + parseDec(e.Betrag_Eur), 0);
  } catch (e) {
    console.error("[einnahme] gebuchteEinnahmenSumme fehlgeschlagen:", e);
    return 0;
  }
}

/**
 * Bucht einen einzelnen Zahlungseingang idempotent als Einnahme.
 * `quelle` muss pro Zahlungseingang eindeutig sein (z. B. Stripe-PI-ID oder
 * Zeitstempel der manuellen Erfassung).
 */
export async function bucheEinnahme(opts: {
  buchungId: number;
  quelle: string;
  betragEur: number;
  datum: string; // YYYY-MM-DD, tatsächliches Zahlungsdatum (Zufluss)
  beschreibung: string;
  rechnungId?: number;
}): Promise<void> {
  const { buchungId, quelle, betragEur, datum, beschreibung, rechnungId } = opts;
  if (!betragEur || betragEur <= 0) return;
  const marker = einnahmeMarker(buchungId, quelle);
  try {
    const vorhanden = await listAllRows<EinnahmeNotizRow>(TABLES.Einnahmen);
    if (vorhanden.results.some((e) => (e.Notizen || "").includes(marker))) return;
    const row: Record<string, unknown> = {
      Datum: datum,
      Beschreibung: beschreibung,
      Betrag_Eur: betragEur,
      Jahr: parseInt(datum.slice(0, 4), 10) || new Date().getFullYear(),
      Notizen: marker,
    };
    if (rechnungId) row.Rechnung_Link = [rechnungId];
    await createRow(TABLES.Einnahmen, row);
  } catch (e) {
    console.error("[einnahme] bucheEinnahme fehlgeschlagen:", e);
  }
}
