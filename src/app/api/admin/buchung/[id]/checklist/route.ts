/**
 * POST /api/admin/buchung/[id]/checklist
 *
 * Body: { item_key: string, checked: boolean, item_type?: "manual" | "pack" }
 *
 * Toggle eines manuellen Checklist-Items.
 *
 * - "manual": speichert in Buchung.Checklist_State_JSON
 * - "pack": speichert in Buchungs_Position.Eingepackt (item_key = position_id)
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";

interface ChecklistState {
  [item_key: string]: { checked: boolean; ts: string };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { item_key?: string; checked?: boolean; item_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.item_key) return NextResponse.json({ error: "item_key required" }, { status: 400 });
  if (typeof body.checked !== "boolean") return NextResponse.json({ error: "checked must be boolean" }, { status: 400 });

  const itemType = body.item_type === "pack" ? "pack" : "manual";
  const now = new Date().toISOString();

  try {
    if (itemType === "pack") {
      // Pack-Item: item_key = position_id, schreibt Eingepackt in T968
      const positionId = parseInt(body.item_key, 10);
      if (!positionId) return NextResponse.json({ error: "item_key (position_id) must be number" }, { status: 400 });
      await updateRow(TABLES.Buchungs_Position, positionId, { Eingepackt: body.checked });
      return NextResponse.json({ ok: true, type: "pack", position_id: positionId, checked: body.checked });
    }

    // Manual Item: Checklist_State_JSON in Buchung updaten
    const buchung = await getRow<{ Checklist_State_JSON: string | null }>(TABLES.Buchungen, buchungId);
    let state: ChecklistState = {};
    try {
      if (buchung.Checklist_State_JSON) {
        const parsed = JSON.parse(buchung.Checklist_State_JSON);
        if (parsed && typeof parsed === "object") state = parsed;
      }
    } catch {
      // ignorieren
    }
    state[body.item_key] = { checked: body.checked, ts: now };
    await updateRow(TABLES.Buchungen, buchungId, { Checklist_State_JSON: JSON.stringify(state) });
    return NextResponse.json({ ok: true, type: "manual", item_key: body.item_key, checked: body.checked });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
