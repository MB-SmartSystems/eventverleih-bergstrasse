/**
 * POST /api/admin/buchung/[id]/service-entfernen
 * Body: { service: "lieferung" | "abholung" | "aufbau" | "abbau" }
 *
 * Entfernt eine nicht in Anspruch genommene Service-Leistung aus der Buchung (Summenfeld
 * Preis_* → 0) und rechnet über recalcBuchung Gesamt/Anzahlung/Restzahlung/Stripe-Links neu.
 * Bei bereits bezahlter Buchung entsteht ggf. ein Guthaben (recalc clampt Restzahlung_Soll=0 +
 * Warning) → im Dashboard als „Guthaben — Rückzahlung offen" sichtbar (kein Auto-Versand).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, updateRow, createRow, TABLES } from "@/lib/baserow/client";
import { recalcBuchung } from "@/lib/buchung-recalc";
import { findRechnungForBuchung } from "@/lib/eventverleih/rechnung";

const SERVICE_FELD: Record<string, string> = {
  lieferung: "Preis_Lieferung",
  abholung: "Preis_Abholung",
  aufbau: "Preis_Aufbau",
  abbau: "Preis_Abbau",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { service?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const feld = body.service ? SERVICE_FELD[body.service] : undefined;
  if (!feld) {
    return NextResponse.json({ error: "service must be lieferung|abholung|aufbau|abbau" }, { status: 400 });
  }

  try {
    // Gesperrt, sobald eine Rechnung existiert (siehe position/[id]/delete): der GoBD-Snapshot
    // ändert sich nicht mit, die Buchung schon.
    const rechnung = await findRechnungForBuchung(buchungId);
    if (rechnung) {
      return NextResponse.json(
        {
          error: "Rechnung bereits erstellt",
          detail: `Für diese Buchung existiert bereits Rechnung ${rechnung.rechnungsnummer}. Leistungen lassen sich danach nicht mehr entfernen. Eine Korrektur läuft über eine Storno- oder Korrekturrechnung.`,
        },
        { status: 409 },
      );
    }

    const before = await getRow<Record<string, unknown>>(TABLES.Buchungen, buchungId);
    const vorher = before[feld];
    await updateRow(TABLES.Buchungen, buchungId, { [feld]: 0 });
    await recalcBuchung(buchungId);

    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Service entfernt (${body.service}) Buchung #${buchungId}`,
        // "Service_entfernt" ist keine gültige Option des Single-Selects Aktion — der Schreibvorgang
        // lief deshalb bisher immer in einen Baserow-400 und wurde vom catch verschluckt.
        Aktion: "Sonstiges",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({ typ: "Service_entfernt", service: body.service, feld, vorher }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[service-entfernen] audit-log fehlgeschlagen:", e);
    }

    return NextResponse.json({ ok: true, service: body.service, vorher });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
