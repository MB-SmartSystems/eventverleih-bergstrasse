/**
 * POST /api/admin/buchung/[id]/uebergabe
 *
 * Body JSON: {
 *   foto_urls: string[],
 *   checkliste: Array<{ position_id: number, name: string, ok: boolean, notiz?: string }>,
 *   kaution_methode: "stripe_preauth" | "bar" | "ec" | "keine",
 *   kaution_eur?: number,            // bei stripe_preauth/bar/ec
 *   kaution_payment_intent_id?: string,  // bei stripe_preauth
 *   uebergabe_adresse?: string,
 *   uebergabe_datum?: string,        // ISO date
 *   notiz?: string,
 * }
 *
 * Setzt Status_Erweitert = "Uebergeben", speichert alle Felder.
 * Audit-Log-Eintrag wird erstellt.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateRow, createRow, TABLES } from "@/lib/baserow/client";
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
    const checkliste = Array.isArray(body.checkliste) ? body.checkliste : [];
    const notiz = body.notiz || "";

    const patch: Record<string, unknown> = {
      Status_Erweitert: "Uebergeben",
      Uebergabe_Foto_URLs: JSON.stringify(fotoUrls),
      Uebergabe_Checkliste_JSON: JSON.stringify(checkliste),
      Uebergabe_Datum: body.uebergabe_datum || new Date().toISOString().slice(0, 10),
    };
    if (body.uebergabe_adresse) patch.Uebergabe_Adresse = body.uebergabe_adresse;
    if (body.kaution_payment_intent_id) {
      patch.Stripe_Kaution_PaymentIntent = body.kaution_payment_intent_id;
    }
    if (body.kaution_eur && body.kaution_methode && body.kaution_methode !== "keine") {
      patch.Kaution_Hinterlegt_am = new Date().toISOString().slice(0, 10);
    }

    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Audit-Log-Eintrag
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Uebergabe Buchung #${buchungId}`,
        Aktion: "Buchung_erstellt", // Closest existing — TODO: erweitern um "Uebergabe"
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          methode: body.kaution_methode,
          kaution_eur: body.kaution_eur,
          foto_count: fotoUrls.length,
          checkliste_count: checkliste.length,
          notiz,
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[uebergabe audit-log]", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
