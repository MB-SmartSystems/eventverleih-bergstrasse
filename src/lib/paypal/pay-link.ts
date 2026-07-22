/**
 * Signierte, dauerhafte PayPal-Zahllinks.
 *
 * Der Link ist deterministisch pro (Buchung, Zahlungsart) und laeuft NICHT ab — beim Oeffnen
 * erzeugt die Zahlseite eine frische PayPal-Order mit dem AKTUELLEN Betrag (kein Stale-Link-
 * Problem). Signatur = HMAC ueber ADMIN_PASSWORD (schon vorhanden) → keine zusaetzliche
 * Env-Variable noetig, Link ist nicht erratbar.
 */
import { createHmac, timingSafeEqual } from "crypto";

export type PayPalPaymentType = "anzahlung" | "restzahlung" | "komplettzahlung";

function secret(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD not set (für PayPal-Link-Signatur)");
  return pw;
}

export function signPayLink(buchungId: number, type: PayPalPaymentType): string {
  return createHmac("sha256", secret())
    .update(`paypal:${buchungId}:${type}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPayLink(buchungId: number, type: PayPalPaymentType, sig: string): boolean {
  const expected = signPayLink(buchungId, type);
  if (!sig || sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://eventverleih-bergstrasse.de";
}

export function buildPayUrl(buchungId: number, type: PayPalPaymentType): string {
  const sig = signPayLink(buchungId, type);
  return `${siteBaseUrl()}/pay/paypal/${buchungId}/${type}?sig=${sig}`;
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

/** Buchungsfelder, aus denen der Default-Betrag berechnet wird (identisch zur Stripe-Admin-Route). */
export interface BetragsFelder {
  Anzahlung_Soll_Eur: string | number | null;
  Restzahlung_Soll_Eur: string | number | null;
  Preis_Artikel: string | number | null;
  Preis_Lieferung: string | number | null;
  Preis_Abholung: string | number | null;
  Preis_Aufbau: string | number | null;
}

export function defaultAmountFor(b: BetragsFelder, type: PayPalPaymentType): number {
  if (type === "anzahlung") return parseDec(b.Anzahlung_Soll_Eur);
  if (type === "restzahlung") return parseDec(b.Restzahlung_Soll_Eur);
  // komplettzahlung = Mietsumme + Lieferung + Abholung + Aufbau (ohne Kaution)
  return (
    parseDec(b.Preis_Artikel) +
    parseDec(b.Preis_Lieferung) +
    parseDec(b.Preis_Abholung) +
    parseDec(b.Preis_Aufbau)
  );
}
