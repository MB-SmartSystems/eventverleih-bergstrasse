/**
 * POST /api/admin/kunde/[id]/update — Stammdaten bearbeiten
 * Body: Subset von Kunden-Feldern (whitelist).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";

const ALLOWED = [
  "Vorname",
  "Nachname",
  "Firma",
  "Email",
  "Telefon",
  "WhatsApp",
  "Adresse_Strasse",
  "Adresse_PLZ",
  "Adresse_Ort",
] as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (!kundeId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== "string") {
        return NextResponse.json({ error: `${k} must be string` }, { status: 400 });
      }
      patch[k] = body[k];
    }
  }

  // Mini-Validation
  if (typeof patch.Email === "string" && patch.Email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.Email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (typeof patch.Adresse_PLZ === "string" && patch.Adresse_PLZ.length > 0 && !/^\d{4,5}$/.test(patch.Adresse_PLZ)) {
    return NextResponse.json({ error: "invalid PLZ" }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  try {
    await updateRow(TABLES.Kunden, kundeId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
