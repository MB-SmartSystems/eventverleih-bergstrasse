/**
 * POST /api/admin/buchung/[id]/upload-foto?type=uebergabe|ruecknahme
 *
 * Body: multipart/form-data mit "file" (image).
 *
 * Speichert Foto im Baserow-User-File-Store und gibt die oeffentliche Media-URL
 * zurueck. Returns: { url }
 *
 * Die URL wird Client-seitig in das Foto-URLs-JSON-Array eingebaut und beim
 * Uebergabe/Ruecknahme-Submit als Gesamtarray in Buchungen.Uebergabe_Foto_URLs /
 * Ruecknahme_Foto_URLs (long_text/JSON) gespeichert — das ist die einzige Ablage
 * dieser Fotos (kein separates File-Feld, um keine zweite Quelle zu erzeugen).
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadUserFile } from "@/lib/baserow/client";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const buchungId = parseInt(params.id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "uebergabe" && type !== "ruecknahme") {
    return NextResponse.json({ error: "type must be uebergabe|ruecknahme" }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }
    const origName = (file as File).name || "foto.jpg";
    const ext = origName.split(".").pop()?.toLowerCase() || "jpg";
    const ts = Date.now();
    const key = `buchung-${buchungId}-${type}-${ts}.${ext}`;
    const contentType = (file as File).type || "image/jpeg";

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadUserFile(buffer, key, contentType);

    return NextResponse.json({ ok: true, url, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
