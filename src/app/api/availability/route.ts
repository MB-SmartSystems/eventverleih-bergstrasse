/**
 * POST /api/availability
 *
 * Body: { von: "YYYY-MM-DD", bis: "YYYY-MM-DD", artikel_ids?: number[] }
 *
 * Liefert pro Artikel ein { artikel_id, available: boolean }.
 * Wenn artikel_ids fehlt, werden alle Artikel zurueckgegeben.
 *
 * Public-Endpoint (kein Auth) — wird vom Sortiment-Frontend genutzt.
 * Antwort enthaelt KEINE Bestands-Anzahl (Plan-Punkt 7: nur ja/nein fuer Kunden).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAvailability, getAvailabilityForAllArtikel } from "@/lib/eventverleih/availability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  let body: { von?: string; bis?: string; artikel_ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const von = body.von || "";
  const bis = body.bis || "";
  if (!ISO_DATE.test(von) || !ISO_DATE.test(bis)) {
    return NextResponse.json({ error: "von/bis muessen YYYY-MM-DD sein" }, { status: 400 });
  }
  if (bis < von) {
    return NextResponse.json({ error: "bis < von" }, { status: 400 });
  }
  // Range-Cap analog /api/contact (60 Tage max) — Spam-Schutz
  const vonDate = new Date(von);
  const bisDate = new Date(bis);
  const days = Math.round((bisDate.getTime() - vonDate.getTime()) / 86_400_000);
  if (days > 60) {
    return NextResponse.json({ error: "Range groesser 60 Tage" }, { status: 400 });
  }

  try {
    const map = Array.isArray(body.artikel_ids) && body.artikel_ids.length > 0
      ? await getAvailability(body.artikel_ids.filter((x) => typeof x === "number"), von, bis)
      : await getAvailabilityForAllArtikel(von, bis);
    const items = Array.from(map.values());
    return NextResponse.json({ ok: true, von, bis, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[availability]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
