/**
 * GET /api/cron/review-reminder — manueller/optionaler Trigger des Review-Reminders.
 *
 * KEIN eigener Vercel-Cron (Hobby-Plan-Cron-Limit) — der tägliche Lauf passiert als
 * Sub-Pass im kaution-reminder-Cron. Diese Route bleibt als manueller Test-/Nachlauf-
 * Endpunkt. Logik in lib/eventverleih/review-reminder.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { runReviewReminder } from "@/lib/eventverleih/review-reminder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReviewReminder();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
