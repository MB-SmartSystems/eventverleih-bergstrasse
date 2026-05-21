/**
 * POST /api/distance
 *
 * Body: { strasse?: string, hausnr?: string, plz: string, ort?: string }
 * Response: { km: number, gefunden: boolean, details?: string }
 *
 * Geocoded die Kunden-Adresse und routet von der Firmen-Adresse via OpenRouteService.
 * Rueckgabe: einfache Strecke in km (Manuel berechnet pro Service separat: 2 €/km Lieferung,
 * 2 €/km Abholung).
 *
 * ENV: ORS_API_KEY (https://openrouteservice.org/dev/#/signup — Free-Tier 2000 req/day)
 */
import { NextRequest, NextResponse } from "next/server";

interface DistanceBody {
  strasse?: string;
  hausnr?: string;
  plz: string;
  ort?: string;
}

interface GeocodeFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { label?: string; confidence?: number };
}

interface GeocodeResponse {
  features?: GeocodeFeature[];
}

interface DirectionsResponse {
  routes?: Array<{ summary?: { distance?: number } }>;
}

const ORS_BASE = "https://api.openrouteservice.org";

// Firmen-Adresse Eventverleih Bergstrasse — Origin fuer alle Lieferungen
const ORIGIN_COORDS: [number, number] = [8.6047, 49.7468]; // Alsbach-Haehnlein (lon, lat)
const ORIGIN_FALLBACK_LABEL = "Schlesierstrasse 19a, 64665 Alsbach-Haehnlein";

async function geocode(apiKey: string, query: string): Promise<[number, number] | null> {
  const url = `${ORS_BASE}/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(query)}&boundary.country=DE&size=1`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = (await r.json()) as GeocodeResponse;
    const feat = data.features?.[0];
    const c = feat?.geometry?.coordinates;
    if (Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1])) {
      return [c[0], c[1]];
    }
    return null;
  } catch (e) {
    console.error("[distance] geocode fehlgeschlagen:", query, e);
    return null;
  }
}

async function routeKm(
  apiKey: string,
  from: [number, number],
  to: [number, number],
): Promise<number | null> {
  const url = `${ORS_BASE}/v2/directions/driving-car`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: [from, to] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as DirectionsResponse;
    const m = data.routes?.[0]?.summary?.distance;
    if (typeof m === "number" && m > 0) {
      // Meter → Kilometer, aufgerundet auf halbe km fuer Pricing-Stabilitaet
      return Math.ceil((m / 1000) * 2) / 2;
    }
    return null;
  } catch (e) {
    console.error("[distance] routing fehlgeschlagen:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ORS_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      { km: 0, gefunden: false, details: "Distance-API nicht konfiguriert" },
      { status: 503 },
    );
  }

  let body: DistanceBody;
  try {
    body = (await req.json()) as DistanceBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.plz || !/^\d{4,5}$/.test(body.plz)) {
    return NextResponse.json(
      { km: 0, gefunden: false, details: "Gueltige PLZ erforderlich" },
      { status: 400 },
    );
  }

  const queryParts = [body.strasse, body.hausnr, body.plz, body.ort].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  if (queryParts.length === 1) {
    queryParts.push("Deutschland");
  }
  const query = queryParts.join(" ");

  const dest = await geocode(apiKey, query);
  if (!dest) {
    return NextResponse.json(
      { km: 0, gefunden: false, details: "Adresse konnte nicht geokodiert werden" },
      { status: 200 },
    );
  }

  const km = await routeKm(apiKey, ORIGIN_COORDS, dest);
  if (km === null) {
    return NextResponse.json(
      { km: 0, gefunden: false, details: "Strecken-Berechnung fehlgeschlagen" },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { km, gefunden: true, origin: ORIGIN_FALLBACK_LABEL },
    {
      headers: { "Cache-Control": "private, max-age=300" },
    },
  );
}
