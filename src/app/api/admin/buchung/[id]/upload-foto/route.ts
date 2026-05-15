/**
 * POST /api/admin/buchung/[id]/upload-foto?type=uebergabe|ruecknahme
 *
 * Body: multipart/form-data mit "file" (image).
 *
 * Speichert Foto in Vercel Blob unter eve/buchung-{id}/{type}-{timestamp}.{ext}.
 * Returns: { url }
 *
 * Die URL wird Client-seitig in das Foto-URLs-JSON-Array eingebaut und
 * beim Uebergabe/Ruecknahme-Submit als Gesamtarray gespeichert.
 */
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
    const filename = (file as File).name || "foto.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const ts = Date.now();
    const key = `eve/buchung-${buchungId}/${type}-${ts}.${ext}`;

    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });

    return NextResponse.json({ ok: true, url: blob.url, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
