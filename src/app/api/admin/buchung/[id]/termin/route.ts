/**
 * POST /api/admin/buchung/[id]/termin
 *
 * Body: { uebergabe_termin?: ISO-datetime | null, rueckgabe_termin?: ISO-datetime | null }
 *
 * Speichert Uebergabe/Rueckgabe-Termine in T951. Triggert (Stub) Google-Calendar-Sync,
 * sobald GCAL_EVENTVERLEIH_ID + Credentials in ENV gesetzt sind.
 *
 * Plan Phase 5 B5 + B6.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";

interface BuchungData {
  id: number;
  Uebergabe_Termin: string | null;
  Rueckgabe_Termin: string | null;
  Calendar_Event_ID_Uebergabe: string | null;
  Calendar_Event_ID_Rueckgabe: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
  Lieferadresse: string | null;
  Preis_Lieferung: string | null;
}

function isValidDateTime(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (v === "") return true; // erlaube leeren String fuer Loeschen
  const d = new Date(v);
  return !isNaN(d.getTime());
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { uebergabe_termin?: string | null; rueckgabe_termin?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.uebergabe_termin !== undefined) {
    if (body.uebergabe_termin === null || body.uebergabe_termin === "") {
      patch.Uebergabe_Termin = null;
    } else if (isValidDateTime(body.uebergabe_termin)) {
      patch.Uebergabe_Termin = new Date(body.uebergabe_termin).toISOString();
    } else {
      return NextResponse.json({ error: "uebergabe_termin invalid" }, { status: 400 });
    }
  }
  if (body.rueckgabe_termin !== undefined) {
    if (body.rueckgabe_termin === null || body.rueckgabe_termin === "") {
      patch.Rueckgabe_Termin = null;
    } else if (isValidDateTime(body.rueckgabe_termin)) {
      patch.Rueckgabe_Termin = new Date(body.rueckgabe_termin).toISOString();
    } else {
      return NextResponse.json({ error: "rueckgabe_termin invalid" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Google-Calendar-Sync (Stub) — wenn ENV-Vars gesetzt
    const calendarId = process.env.GCAL_EVENTVERLEIH_ID;
    const webhookUrl = process.env.N8N_CALENDAR_SYNC_URL;
    if (calendarId && webhookUrl) {
      try {
        const buchung = await getRow<BuchungData>(TABLES.Buchungen, buchungId);
        let kundeName = buchung.Kunde_Link?.[0]?.value || "";
        const kid = buchung.Kunde_Link?.[0]?.id;
        if (kid) {
          try {
            const k = await getRow<{ Vorname?: string; Nachname?: string }>(TABLES.Kunden, kid);
            kundeName = `${k?.Vorname ?? ""} ${k?.Nachname ?? ""}`.trim() || kundeName;
          } catch {
            /* fail-soft: Name bleibt Fallback */
          }
        }
        const hatLieferung = parseFloat(buchung.Preis_Lieferung ?? "0") > 0;
        const location =
          hatLieferung && buchung.Lieferadresse
            ? buchung.Lieferadresse
            : "Treffpunkt Grillhütte Sandwiese, Alsbach-Hähnlein";
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buchung_id: buchungId,
            calendar_id: calendarId,
            uebergabe_termin: buchung.Uebergabe_Termin,
            rueckgabe_termin: buchung.Rueckgabe_Termin,
            existing_uebergabe_event: buchung.Calendar_Event_ID_Uebergabe,
            existing_rueckgabe_event: buchung.Calendar_Event_ID_Rueckgabe,
            kunde_name: kundeName,
            location,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (e) {
        console.error("[termin] calendar-sync fehlgeschlagen (non-fatal):", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
