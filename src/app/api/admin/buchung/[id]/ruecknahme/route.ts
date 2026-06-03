/**
 * POST /api/admin/buchung/[id]/ruecknahme  — Moment 1 der Rückgabe (am Treffpunkt)
 *
 * Body JSON: {
 *   foto_urls?: string[],
 *   vollstaendigkeit?: Array<{ position_id: number, name: string, anzahl: number, status: "da"|"fehlt" }>,
 *   notiz?: string,
 *   ruecknahme_datum?: string,
 * }
 *
 * Setzt Status_Erweitert = "Zurueckgegeben", speichert Vollständigkeits-Checkliste + Fotos.
 * KEINE Kaution-Auflösung, KEINE Schaden-Erfassung, KEINE Mail — das passiert in Moment 2
 * (kaution-erstatten). Kaution bleibt offen → 2-Werktage-Prüffrist startet, wenn Kaution > 0.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, updateRow, createRow, TABLES } from "@/lib/baserow/client";
import { invalidateAvailabilityCache } from "@/lib/eventverleih/availability";
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

  try {
    const body = await req.json();
    const fotoUrls = Array.isArray(body.foto_urls) ? body.foto_urls : [];
    const vollstaendigkeit = Array.isArray(body.vollstaendigkeit) ? body.vollstaendigkeit : [];
    const fehlend = vollstaendigkeit.filter(
      (v: { status?: string }) => v?.status === "fehlt",
    );

    const buchung = await getRow<{ Kaution_Soll_Eur: number | string | null }>(
      TABLES.Buchungen,
      buchungId,
    );
    const kautionSoll = parseFloat(String(buchung.Kaution_Soll_Eur ?? "0")) || 0;

    const patch: Record<string, unknown> = {
      Status_Erweitert: "Zurueckgegeben",
      Ruecknahme_Foto_URLs: JSON.stringify(fotoUrls),
      Ruecknahme_Vollstaendigkeit_JSON: JSON.stringify(vollstaendigkeit),
      Ruecknahme_Datum: body.ruecknahme_datum || new Date().toISOString().slice(0, 10),
    };

    // Kaution bleibt offen → 2-Werktage-Prüffrist starten (Schaden-Check folgt in Moment 2)
    if (kautionSoll > 0) {
      const prueffrist = new Date();
      prueffrist.setDate(prueffrist.getDate() + 2); // pragmatisch +2 Tage
      patch.Kaution_Pruefung_Status = "offen";
      patch.Kaution_Prueffrist_bis = prueffrist.toISOString().slice(0, 10);
    }

    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Audit-Log
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Ruecknahme Buchung #${buchungId}`,
        Aktion: "Ruecknahme",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          positionen: vollstaendigkeit.length,
          fehlend: fehlend.map((f: { name?: string; anzahl?: number }) => `${f.anzahl ?? ""}× ${f.name ?? ""}`.trim()),
          foto_count: fotoUrls.length,
          notiz: body.notiz || "",
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[ruecknahme audit-log]", e);
    }

    invalidateAvailabilityCache();
    return NextResponse.json({ ok: true, fehlend: fehlend.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
