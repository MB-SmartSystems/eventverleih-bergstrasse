/**
 * POST /api/internal/store-pdf?table=rechnung|angebot&id=<rowId>
 *
 * Interner Endpoint fuer den n8n-Render-Flow (eve-pdf-render): nimmt eine
 * gerenderte PDF (Binary-Body, application/pdf) entgegen, laedt sie zu Vercel
 * Blob und schreibt die URL nach Baserow (Rechnungen.PDF_URL / Angebote.PDF_URL).
 *
 * Dadurch erscheint im Kundenbereich der Download-Button (rendert bei gesetzter
 * PDF_URL). Der bestehende Rechnungs-MAIL-Workflow bleibt davon unberuehrt —
 * dieser Pfad dient nur der Ablage zum spaeteren Download.
 *
 * Auth: Header `x-internal-secret` === STORE_PDF_SECRET (Vercel-Env, geteilt mit n8n).
 */
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { updateRow, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TABLE_MAP: Record<string, { tableId: number; prefix: string }> = {
  rechnung: { tableId: TABLES.Rechnungen, prefix: "rechnungen" },
  angebot: { tableId: TABLES.Angebote, prefix: "angebote" },
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret") || "";
  const expected = process.env.STORE_PDF_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const table = (searchParams.get("table") || "").toLowerCase();
  const id = parseInt(searchParams.get("id") || "", 10);
  const cfg = TABLE_MAP[table];
  if (!cfg) return NextResponse.json({ error: "table must be rechnung|angebot" }, { status: 400 });
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    // Sanity: eine echte PDF ist > ein paar KB und beginnt mit %PDF-
    if (buf.byteLength < 200 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "kein gueltiger PDF-Body" }, { status: 422 });
    }
    const pathname = `${cfg.prefix}/${table}-${id}.pdf`;
    const blob = await put(pathname, buf, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    await updateRow(cfg.tableId, id, { PDF_URL: blob.url });
    return NextResponse.json({ ok: true, url: blob.url, bytes: buf.byteLength });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[store-pdf]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
