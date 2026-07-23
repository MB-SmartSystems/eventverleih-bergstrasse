/**
 * POST /api/admin/position/[id]/delete
 * Body: { buchungId: number }
 *
 * Entfernt eine Artikel-Position und rechnet die Buchung serverseitig neu.
 *
 * Gesperrt (409), sobald für die Buchung eine Rechnung existiert: der Rechnungs-Snapshot ist
 * GoBD-eingefroren und ändert sich nicht mit, die Buchung schon. Ohne Sperre liefe die
 * Buchungssumme still von der ausgestellten Rechnung weg. Korrekturen laufen danach über eine
 * Storno- oder Korrekturrechnung.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, deleteRow, getRow, TABLES } from "@/lib/baserow/client";
import { recalcBuchung } from "@/lib/buchung-recalc";
import { findRechnungForBuchung } from "@/lib/eventverleih/rechnung";

type PositionRow = {
  id: number;
  Anzahl: string | null;
  Einzelpreis_Eur: string | null;
  Position_Gesamt_Eur: string | null;
  Artikel_Link: Array<{ id: number; value: string }> | null;
  Buchung_Link: Array<{ id: number }> | null;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const positionId = parseInt(id, 10);
  if (!positionId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { buchungId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.buchungId !== "number") return NextResponse.json({ error: "buchungId required" }, { status: 400 });
  const buchungId = body.buchungId;

  try {
    // Die maßgebliche Buchung ist die an der Position verlinkte, NICHT die aus dem Body: sonst
    // ließe sich der Rechnungs-Guard umgehen, indem ein direkter Aufruf eine ungesperrte
    // buchungId mitschickt und damit eine Position einer abgerechneten Buchung löscht (und
    // obendrein die falsche Buchung neu berechnet). Der Body-Wert wird nur noch gegengeprüft.
    const vorher = await getRow<PositionRow>(TABLES.Buchungs_Position, positionId);
    const echteBuchungId = vorher.Buchung_Link?.[0]?.id;
    if (!echteBuchungId) {
      return NextResponse.json({ error: "Position hat keine Buchung" }, { status: 422 });
    }
    if (echteBuchungId !== buchungId) {
      return NextResponse.json(
        { error: "buchungId passt nicht zur Position", detail: `Position ${positionId} gehört zu Buchung ${echteBuchungId}.` },
        { status: 400 },
      );
    }

    const rechnung = await findRechnungForBuchung(echteBuchungId);
    if (rechnung) {
      return NextResponse.json(
        {
          error: "Rechnung bereits erstellt",
          detail: `Für diese Buchung existiert bereits Rechnung ${rechnung.rechnungsnummer}. Positionen lassen sich danach nicht mehr entfernen. Eine Korrektur läuft über eine Storno- oder Korrekturrechnung.`,
        },
        { status: 409 },
      );
    }

    await deleteRow(TABLES.Buchungs_Position, positionId);
    await recalcBuchung(echteBuchungId);

    // Audit-Log best effort: eine geldrelevante Änderung soll eine Spur hinterlassen, ein
    // fehlgeschlagener Log-Eintrag darf die bereits vollzogene Löschung aber nicht kippen.
    try {
      const artikelId = vorher.Artikel_Link?.[0]?.id;
      let artikel = vorher.Artikel_Link?.[0]?.value ?? "Artikel";
      if (artikelId) {
        const a = await getRow<{ Bezeichnung: string }>(TABLES.Artikel, artikelId);
        if (a.Bezeichnung) artikel = a.Bezeichnung;
      }
      await createRow(TABLES.Audit_Log, {
        Name: `Position entfernt (${artikel}) Buchung #${buchungId}`,
        // Aktion ist ein Single-Select ohne passende Option; die echte Aktion steht in Details.typ.
        Aktion: "Sonstiges",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          typ: "Position_entfernt",
          position_id: positionId,
          artikel,
          anzahl: vorher.Anzahl,
          einzelpreis_eur: vorher.Einzelpreis_Eur,
          gesamt_eur: vorher.Position_Gesamt_Eur,
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[position-delete] audit-log fehlgeschlagen:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
