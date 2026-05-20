/**
 * Member-Auth — Magic-Link via Mail-Token, Cookie-basierte Session.
 *
 * Plan Phase 5 C1: kein neues Tool wie Resend, sondern bestehende MailQueue + Token
 * direkt im Kunde-Datensatz (T949).
 *
 * Workflow:
 *   - Token wird einmal pro Kunde generiert (langlebig, 30 Tage), gespeichert in
 *     T949.Member_Session_Token + Member_Session_Expires.
 *   - Token wird in alle transaktionalen Mails als Link-Param `?token=...` eingefuegt:
 *     `https://eventverleih-bergstrasse.de/mein-bereich/login?token=XYZ`
 *   - Klick auf Link → Server prueft Token gueltig → setzt HttpOnly-Cookie + redirect /mein-bereich
 *   - Cookie wird in jedem /mein-bereich-Request gegen den Token-Wert in T949 verifiziert.
 *
 * Login-Fallback: /mein-bereich Login-Form mit Mail-Input → /api/member/login-link
 * triggert MailQueue mit Magic-Link, Token wird neu generiert.
 */
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { listRows, updateRow, TABLES } from "@/lib/baserow/client";

export const MEMBER_COOKIE_NAME = "member_session";
export const TOKEN_TTL_DAYS = 30;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

interface KundenAuthFields {
  id: number;
  Vorname?: string;
  Nachname?: string;
  Email?: string;
  Member_Session_Token?: string | null;
  Member_Session_Expires?: string | null;
}

/**
 * Stellt sicher, dass ein Kunde einen gueltigen Member-Token hat.
 * Generiert neuen wenn keiner da oder abgelaufen — schreibt zurueck in Baserow.
 */
export async function ensureMemberToken(kundeId: number): Promise<string> {
  const kunden = await listRows<KundenAuthFields>(TABLES.Kunden, { search: String(kundeId), size: 50 });
  const kunde = kunden.results.find((k) => k.id === kundeId);
  if (!kunde) throw new Error(`Kunde ${kundeId} not found`);

  const now = Date.now();
  const existingExpires = kunde.Member_Session_Expires ? new Date(kunde.Member_Session_Expires).getTime() : 0;
  if (kunde.Member_Session_Token && existingExpires > now + 7 * 86400_000) {
    // Noch laenger als 7 Tage gueltig → wiederverwenden
    return kunde.Member_Session_Token;
  }

  const newToken = generateToken();
  const newExpires = new Date(now + TOKEN_TTL_DAYS * 86400_000).toISOString();
  await updateRow(TABLES.Kunden, kundeId, {
    Member_Session_Token: newToken,
    Member_Session_Expires: newExpires,
  });
  return newToken;
}

/**
 * Verifiziert einen Token gegen T949. Returnt Kunde wenn gueltig, sonst null.
 */
export async function verifyMemberToken(token: string): Promise<KundenAuthFields | null> {
  if (!token || token.length < 20) return null;
  // Baserow search durchsucht alle textuellen Felder; wir filtern selbst nach exaktem Match
  const kunden = await listRows<KundenAuthFields>(TABLES.Kunden, { search: token, size: 50 });
  const kunde = kunden.results.find((k) => k.Member_Session_Token === token);
  if (!kunde) return null;
  const expires = kunde.Member_Session_Expires ? new Date(kunde.Member_Session_Expires).getTime() : 0;
  if (expires < Date.now()) return null;
  return kunde;
}

/**
 * Sucht Kunde per E-Mail, generiert/rotiert Token, returns Magic-Link.
 */
export async function generateMagicLinkForEmail(email: string, baseUrl: string): Promise<string | null> {
  const target = email.toLowerCase().trim();
  if (!target) return null;
  const kunden = await listRows<KundenAuthFields>(TABLES.Kunden, { search: target, size: 50 });
  const kunde = kunden.results.find((k) => (k.Email || "").toLowerCase() === target);
  if (!kunde) return null;
  const token = await ensureMemberToken(kunde.id);
  return `${baseUrl}/mein-bereich/login?token=${token}`;
}

/**
 * Convenience-Helper: erzeugt einen ready-to-use Mein-Bereich-Login-Link.
 * Wird in transaktionalen Mails eingebettet, damit Kunde direkt eingeloggt rauskommt.
 */
export async function memberAutoLoginUrl(kundeId: number, baseUrl?: string): Promise<string> {
  const base = baseUrl || "https://eventverleih-bergstrasse.de";
  const token = await ensureMemberToken(kundeId);
  return `${base}/mein-bereich/login?token=${token}`;
}

/**
 * Liest Session-Cookie + verifiziert. Returns Kunde oder null. Fuer Server-Components.
 */
export async function getCurrentMember(): Promise<KundenAuthFields | null> {
  const c = await cookies();
  const tok = c.get(MEMBER_COOKIE_NAME)?.value;
  if (!tok) return null;
  return verifyMemberToken(tok);
}
