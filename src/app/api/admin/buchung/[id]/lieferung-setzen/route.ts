/**
 * POST /api/admin/buchung/[id]/lieferung-setzen
 *
 * Setzt fuer eine bestehende Buchung nachtraeglich:
 *  - Lieferung (km × 2 €)
 *  - Abholung  (km × 2 €)
 *  - Aufbau-Service (Summe aller Buchungs_Position.Aufbau_Pauschale_Snapshot_Eur × Anzahl)
 *  - Liefer-Adresse + Adress-Notiz
 *
 * Danach wird recalcBuchung() getriggert → Anzahlung/Restzahlung werden auf der
 * neuen Basis (Mietsumme + Lieferung + Aufbau) neu berechnet, Stripe-Anzahlungs-Link
 * wird automatisch regeneriert wenn er bereits existiert und sich der Betrag aendert
 * (P6 — Stripe-Link-Refresh).
 *
 * Body:
 *   {
 *     lieferung: boolean,
 *     abholung: boolean,
 *     aufbau: boolean,
 *     distance_km?: number,        // nur relevant wenn lieferung || abholung
 *     liefer_strasse?: string,
 *     liefer_hausnr?: string,
 *     liefer_plz?: string,
 *     liefer_ort?: string,
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, listAllRows, updateRow, TABLES } from "@/lib/baserow/client";
import { isAuthenticated } from "@/lib/auth";
import { recalcBuchung } from "@/lib/buchung-recalc";

export const dynamic = "force-dynamic";

interface Body {
  lieferung?: boolean;
  abholung?: boolean;
  aufbau?: boolean;
  distance_km?: number | null;
  liefer_strasse?: string;
  liefer_hausnr?: string;
  liefer_plz?: string;
  liefer_ort?: string;
}

type PositionRow = {
  Buchung_Link: Array<{ id: number }>;
  Anzahl: string;
  Aufbau_Pauschale_Snapshot_Eur: string | null;
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const lieferung = !!body.lieferung;
  const abholung = !!body.abholung;
  const aufbau = !!body.aufbau;
  const distKm = typeof body.distance_km === "number" && body.distance_km > 0 ? body.distance_km : 0;

  if ((lieferung || abholung) && distKm <= 0) {
    return NextResponse.json(
      { error: "distance_km erforderlich wenn lieferung oder abholung gesetzt" },
      { status: 400 },
    );
  }

  try {
    const buchung = await getRow<{
      id: number;
      Lieferadresse: string | null;
      Notizen: string | null;
    }>(TABLES.Buchungen, buchungId);

    // Liefer-Preis berechnen
    const lieferpreis = lieferung && distKm > 0 ? distKm * 2 : 0;
    const abholpreis = abholung && distKm > 0 ? distKm * 2 : 0;
    const lieferGesamt = lieferpreis + abholpreis;

    // Aufbau-Preis: Summe aller Buchungs_Position.Aufbau_Pauschale_Snapshot_Eur × Anzahl
    let aufbauSumme = 0;
    if (aufbau) {
      const allePositionen = await listAllRows<PositionRow>(TABLES.Buchungs_Position);
      const myPositionen = allePositionen.results.filter(
        (p) => p.Buchung_Link?.[0]?.id === buchungId,
      );
      for (const p of myPositionen) {
        aufbauSumme += num(p.Anzahl) * num(p.Aufbau_Pauschale_Snapshot_Eur);
      }
    }

    // Liefer-Adresse als String
    const adrTeile = [
      body.liefer_strasse?.trim(),
      body.liefer_hausnr?.trim(),
      body.liefer_plz?.trim(),
      body.liefer_ort?.trim(),
    ].filter((p): p is string => !!p && p.length > 0);
    const lieferadresseStr = adrTeile.length > 0 ? adrTeile.join(" ").replace(" " + (body.liefer_plz?.trim() ?? ""), ", " + (body.liefer_plz?.trim() ?? "")) : null;

    // Notiz-Block fuer die Buchung anhaengen (nicht überschreiben — Anfrage-Text bleibt)
    const zusatzBlock: string[] = [];
    if (aufbau && aufbauSumme > 0) zusatzBlock.push(`Aufbau-Service: ${aufbauSumme.toFixed(2)} EUR`);
    if (lieferung) zusatzBlock.push(`Lieferung gewuenscht (${distKm} km, ${lieferpreis.toFixed(2)} EUR)`);
    if (abholung) zusatzBlock.push(`Abholung gewuenscht (${distKm} km, ${abholpreis.toFixed(2)} EUR)`);
    if (lieferadresseStr) zusatzBlock.push(`Event-Adresse: ${lieferadresseStr}`);

    const today = new Date().toISOString().slice(0, 10);
    const noteAppend = zusatzBlock.length > 0
      ? `\n\n--- Nachtraeglich gesetzt am ${today} ---\n${zusatzBlock.join("\n")}`
      : "";
    const newNotizen = (buchung.Notizen || "") + noteAppend;

    const update: Record<string, unknown> = {
      Preis_Lieferung: lieferGesamt.toFixed(2),
      Preis_Aufbau: aufbau && aufbauSumme > 0 ? aufbauSumme.toFixed(2) : "0.00",
      Aufbau_gewuenscht: aufbau,
      ...(lieferadresseStr ? { Lieferadresse: lieferadresseStr } : {}),
      ...(noteAppend ? { Notizen: newNotizen } : {}),
    };
    await updateRow(TABLES.Buchungen, buchungId, update);

    // recalc: berechnet Anzahlung neu auf Basis (Mietsumme + neue Lieferung + neuer Aufbau)
    // und refreshes Stripe-Anzahlungs-Link wenn vorhanden + sich der Betrag aendert.
    await recalcBuchung(buchungId);

    return NextResponse.json({
      ok: true,
      preis_lieferung: lieferGesamt,
      preis_aufbau: aufbau ? aufbauSumme : 0,
      lieferadresse: lieferadresseStr,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[lieferung-setzen]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
