/**
 * POST /api/admin/mailqueue/[id]/approve
 *
 * Setzt eine MailQueue-Row (Pending) auf Approved. Der n8n-Workflow
 * `eve-mailqueue-poll` versendet sie beim nächsten 1-Min-Poll.
 *
 * Konsistent mit den Trigger-Phrasen im /guten-morgen — beide Wege münden
 * im selben Baserow-PATCH.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const mailId = parseInt(id, 10);
  if (!mailId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await updateRow(TABLES.MailQueue, mailId, {
      Approval_Status: "Approved",
      Approval_am: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
