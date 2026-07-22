/**
 * Distance-Berechnung via OpenRouteService (Geocode + Routing).
 *
 * Origin = Firmen-Adresse Eventverleih Bergstrasse (hartcoded).
 * Result-km = einfache Strecke (one-way), aufgerundet auf 0,5 km fuer Pricing-Stabilitaet.
 *
 * Frontend: nutzt /api/distance. Backend-Endpoints (z.B. /api/admin/buchung/.../lieferung-setzen)
 * nutzen computeDistanceKm() direkt — kein HTTP-Hop in die eigene App.
 */

const ORS_BASE = "https://api.openrouteservice.org";

// Firmen-Adresse Eventverleih Bergstrasse: Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
export const ORIGIN_COORDS: [number, number] = [8.6047, 49.7468]; // (lon, lat)
export const ORIGIN_LABEL = "Schlesierstrasse 19a, 64665 Alsbach-Haehnlein";

export interface AddressInput {
  strasse?: string | null;
  hausnr?: string | null;
  plz?: string | null;
  ort?: string | null;
}

export interface DistanceResult {
  km: number;
  gefunden: boolean;
  details?: string;
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
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [from, to] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as DirectionsResponse;
    const m = data.routes?.[0]?.summary?.distance;
    if (typeof m === "number" && m > 0) {
      return Math.ceil((m / 1000) * 2) / 2;
    }
    return null;
  } catch (e) {
    console.error("[distance] routing fehlgeschlagen:", e);
    return null;
  }
}

/**
 * Geokodiert die Adresse und berechnet Auto-Routing-Distanz ab ORIGIN_COORDS.
 * Bei fehlender API-Konfiguration oder Geocode-Fail: gefunden=false, km=0.
 */
export async function computeDistanceKm(addr: AddressInput): Promise<DistanceResult> {
  const apiKey = process.env.ORS_API_KEY || "";
  if (!apiKey) {
    return { km: 0, gefunden: false, details: "Distance-API nicht konfiguriert (ORS_API_KEY fehlt)" };
  }
  if (!addr.plz || !/^\d{4,5}$/.test(addr.plz)) {
    return { km: 0, gefunden: false, details: "Gültige PLZ erforderlich" };
  }

  const queryParts = [addr.strasse, addr.hausnr, addr.plz, addr.ort]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  if (queryParts.length === 1) queryParts.push("Deutschland");
  const query = queryParts.join(" ");

  const dest = await geocode(apiKey, query);
  if (!dest) {
    return { km: 0, gefunden: false, details: "Adresse konnte nicht geokodiert werden" };
  }

  const km = await routeKm(apiKey, ORIGIN_COORDS, dest);
  if (km === null) {
    return { km: 0, gefunden: false, details: "Strecken-Berechnung fehlgeschlagen" };
  }

  return { km, gefunden: true };
}
