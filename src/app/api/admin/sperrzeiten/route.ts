/**
 * /api/admin/sperrzeiten
 *  POST   { von, bis, grund? }   → Sperrzeit anlegen
 *  DELETE ?id=123               → Sperrzeit löschen
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, deleteRow, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";

function isYmd(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { von?: string; bis?: string; grund?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!isYmd(body.von) || !isYmd(body.bis)) {
    return NextResponse.json({ error: "von/bis müssen YYYY-MM-DD sein" }, { status: 400 });
  }
  if (body.bis < body.von) {
    return NextResponse.json({ error: "bis liegt vor von" }, { status: 400 });
  }
  try {
    const created = await createRow(TABLES.Sperrzeiten, {
      Name: body.grund?.trim() || "Urlaub",
      Von: body.von,
      Bis: body.bis,
      Grund: body.grund?.trim() || "Urlaub",
      Aktiv: true,
    });
    return NextResponse.json({ ok: true, id: (created as { id: number }).id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = parseInt(req.nextUrl.searchParams.get("id") || "", 10);
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    await deleteRow(TABLES.Sperrzeiten, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
