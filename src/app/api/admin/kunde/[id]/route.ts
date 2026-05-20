/**
 * DELETE /api/admin/kunde/[id] — Kunde loeschen (Plan Phase 5 C6).
 *
 * Pre-Check: Hat Kunde noch Buchungen? Wenn ja → blockt.
 * Sonst → Loeschen + Audit-Log "DSGVO_Loeschung_ausgefuehrt".
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, deleteRow, listAllRows, createRow, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";

interface KundeRow { id: number; Email?: string; Vorname?: string; Nachname?: string }
interface BuchungRow { id: number; Kunde_Link: Array<{ id: number; value: string }> | null }

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const kundeId = parseInt(id, 10);
  if (!kundeId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    // Pre-Check: gibt es Buchungen?
    const buchungen = await listAllRows<BuchungRow>(TABLES.Buchungen);
    const linkedBuchungen = buchungen.results.filter((b) =>
      b.Kunde_Link?.some((k) => k.id === kundeId),
    );
    if (linkedBuchungen.length > 0) {
      return NextResponse.json({
        error: "kunde_has_buchungen",
        detail: `Kunde hat noch ${linkedBuchungen.length} verlinkte Buchung(en). Bitte erst Buchungen verarbeiten oder loeschen.`,
        buchung_count: linkedBuchungen.length,
        buchung_ids: linkedBuchungen.map((b) => b.id).slice(0, 10),
      }, { status: 409 });
    }

    // Kunde-Daten fuer Audit-Log holen
    const kunde = await getRow<KundeRow>(TABLES.Kunden, kundeId).catch(() => null);

    // Audit-Log VOR Delete (sonst ist Kunde weg)
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `DSGVO-Loeschung Kunde #${kundeId}`,
        Aktion: "DSGVO_Loeschung_ausgefuehrt",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: "",
        Akteur: "Backoffice (manuell)",
        Details: JSON.stringify({
          kunde_id: kundeId,
          email: kunde?.Email || "",
          name: `${kunde?.Vorname || ""} ${kunde?.Nachname || ""}`.trim(),
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[kunde-delete] audit-log fehlgeschlagen:", e);
    }

    // Delete
    await deleteRow(TABLES.Kunden, kundeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
