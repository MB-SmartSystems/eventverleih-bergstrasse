/**
 * POST /api/admin/buchung/[id]/event-datum
 * Body: { von: "YYYY-MM-DD", bis: "YYYY-MM-DD" }
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { von?: string; bis?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.von || !DATE_RE.test(body.von)) return NextResponse.json({ error: "von erwartet YYYY-MM-DD" }, { status: 400 });
  const bis = body.bis && DATE_RE.test(body.bis) ? body.bis : body.von;
  if (bis < body.von) return NextResponse.json({ error: "bis darf nicht vor von liegen" }, { status: 400 });

  try {
    await updateRow(TABLES.Buchungen, buchungId, {
      Event_datum_von: body.von,
      Event_datum_bis: bis,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
