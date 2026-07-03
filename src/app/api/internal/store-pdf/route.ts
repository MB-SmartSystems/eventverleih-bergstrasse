/**
 * POST /api/internal/store-pdf?table=rechnung|angebot&id=<rowId>
 *
 * Interner Endpoint fuer den n8n-Render-Flow (eve-pdf-render): nimmt eine
 * gerenderte PDF (Binary-Body, application/pdf) entgegen, laedt sie in den
 * Baserow-User-File-Store und schreibt die Ablage nach Baserow:
 *   - PDF_URL (url-Feld) = oeffentliche Media-URL → Download-Button im Kundenbereich
 *   - Angebot_PDF / Rechnung_PDF (file-Feld) = die PDF an der Zeile (GoBD: Beleg
 *     bleibt in der Datenbank auffindbar, unabhaengig von einer externen URL).
 *
 * Der bestehende Rechnungs-MAIL-Workflow bleibt davon unberuehrt — dieser Pfad
 * dient nur der Ablage zum spaeteren Download.
 *
 * Auth: Header `x-internal-secret` === STORE_PDF_SECRET (Vercel-Env, geteilt mit n8n).
 */
import { NextRequest, NextResponse } from "next/server";
import { updateRow, uploadUserFileMeta, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TABLE_MAP: Record<string, { tableId: number; fileField: string }> = {
  rechnung: { tableId: TABLES.Rechnungen, fileField: "Rechnung_PDF" },
  angebot: { tableId: TABLES.Angebote, fileField: "Angebot_PDF" },
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
    const filename = `${table}-${id}.pdf`;
    const { url, name } = await uploadUserFileMeta(buf, filename, "application/pdf");
    await updateRow(cfg.tableId, id, {
      PDF_URL: url,
      [cfg.fileField]: [{ name }],
    });
    return NextResponse.json({ ok: true, url, bytes: buf.byteLength });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[store-pdf]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
