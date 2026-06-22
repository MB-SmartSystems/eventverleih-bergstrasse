import { NextResponse } from "next/server";

// kontakt-integrity DoD 9: Dependency-Health der Anfrage-Strecke.
// Prueft, ob Baserow (DB 267, dauerhafter Speicher) erreichbar + Token gueltig ist und ob der
// Telegram/E-Mail-Notify-Webhook konfiguriert ist. Vom n8n-Health-Watcher gepingt; Alarm nur bei 503.

const BASE = process.env.BASEROW_BASE_URL || "https://baserow.mb-smartsystems.de";
const TOKEN = process.env.BASEROW_TOKEN;

export async function GET() {
  const checks: Record<string, boolean> = {
    baserow_env: Boolean(TOKEN),
    notify_url: Boolean(process.env.N8N_ANFRAGE_NOTIFY_URL),
  };
  if (checks.baserow_env) {
    try {
      const res = await fetch(`${BASE}/api/database/rows/table/951/?size=1`, {
        headers: { Authorization: `Token ${TOKEN}` },
        cache: "no-store",
      });
      checks.baserow_reachable = res.ok;
    } catch {
      checks.baserow_reachable = false;
    }
  } else {
    checks.baserow_reachable = false;
  }
  const ok = checks.baserow_reachable;
  return NextResponse.json({ ok, checks, ts: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
