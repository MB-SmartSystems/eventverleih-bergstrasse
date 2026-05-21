/**
 * POST /api/distance
 *
 * Body: { strasse?: string, hausnr?: string, plz: string, ort?: string }
 * Response: { km: number, gefunden: boolean, details?: string, origin?: string }
 *
 * Geocode + Routing via OpenRouteService. Logik liegt in /lib/eventverleih/distance.ts
 * (auch von /api/admin/buchung/[id]/lieferung-setzen genutzt).
 */
import { NextRequest, NextResponse } from "next/server";
import { computeDistanceKm, ORIGIN_LABEL } from "@/lib/eventverleih/distance";

interface DistanceBody {
  strasse?: string;
  hausnr?: string;
  plz: string;
  ort?: string;
}

export async function POST(req: NextRequest) {
  let body: DistanceBody;
  try {
    body = (await req.json()) as DistanceBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await computeDistanceKm(body);
  const status = result.gefunden ? 200 : result.details?.includes("PLZ") ? 400 : 200;
  return NextResponse.json(
    { ...result, origin: ORIGIN_LABEL },
    {
      status,
      headers: result.gefunden
        ? { "Cache-Control": "private, max-age=300" }
        : { "Cache-Control": "no-store" },
    },
  );
}
