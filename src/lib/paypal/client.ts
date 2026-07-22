/**
 * PayPal-REST-Client (Orders v2).
 *
 * ENV-Required:
 *   PAYPAL_ENV        = "live" | "sandbox"  (steuert die API-Base-URL)
 *   PAYPAL_CLIENT_ID  = Client ID der PayPal-App
 *   PAYPAL_SECRET     = Secret der PayPal-App
 *   PAYPAL_WEBHOOK_ID = Webhook-ID (fuer Signatur-Verifikation; erst nach Registrierung noetig)
 *
 * Analog zu lib/stripe/client.ts. Geld direkt aufs PayPal-Business-Konto
 * (info@eventverleih-bergstrasse.de). Deckt Anzahlung / Restzahlung / Komplettzahlung ab —
 * KEINE Kaution (die bleibt Stripe-Pre-Auth bzw. bar/Ueberweisung).
 */

export function getPayPalBase(): string {
  const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
  return env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function getPayPalWebhookId(): string {
  const id = process.env.PAYPAL_WEBHOOK_ID;
  if (!id) throw new Error("PAYPAL_WEBHOOK_ID missing in env");
  return id;
}

// OAuth-Access-Token cachen (client_credentials, ~9h gueltig). Wir refreshen 60s vor Ablauf.
let _token: { value: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  if (_token && Date.now() < _token.expiresAt - 60_000) {
    return _token.value;
  }
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_SECRET missing in env");
  }
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${getPayPalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PayPal OAuth fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  _token = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 32000) * 1000,
  };
  return _token.value;
}

/**
 * Kleiner Wrapper fuer authentifizierte PayPal-REST-Calls.
 * Wirft bei !ok mit gekuerztem Fehlertext (kein Secret-Leak).
 */
export async function paypalFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${getPayPalBase()}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal ${init.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}
