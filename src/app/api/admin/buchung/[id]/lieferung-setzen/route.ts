/**
 * POST /api/admin/buchung/[id]/lieferung-setzen
 *
 * Setzt fuer eine bestehende Buchung nachtraeglich:
 *  - Lieferung (km × 2 €)
 *  - Abholung  (km × 2 €)
 *  - Aufbau-Service (Summe aller Buchungs_Position.Aufbau_Pauschale_Snapshot_Eur × Anzahl)
 *  - Liefer-Adresse + Adress-Notiz
 *
 * Source-of-Truth fuer Adresse (Prioritaet):
 *  1. Body-Felder (liefer_strasse / hausnr / plz / ort) falls geliefert
 *  2. Buchung.Lieferadresse falls bereits gesetzt
 *  3. Kunde.Adresse_Strasse + Adresse_PLZ + Adresse_Ort
 *
 * Distance wird automatisch server-side berechnet falls nicht im Body — Frontend kann
 * den Wert aber durchreichen wenn er ihn schon hat (z.B. Live-Anzeige im UI).
 *
 * Danach: recalcBuchung() → Anzahlung auf neue Basis + Stripe-Anzahlungs-Link-Refresh.
 *
 * Body (alles optional ausser den Booleans):
 *   {
 *     lieferung: boolean,
 *     abholung: boolean,
 *     aufbau: boolean,
 *     distance_km?: number,
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
import { computeDistanceKm } from "@/lib/eventverleih/distance";

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

type BuchungRow = {
  id: number;
  Lieferadresse: string | null;
  Notizen: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
};

type KundeRow = {
  id: number;
  Adresse_Strasse: string | null;
  Adresse_PLZ: string | null;
  Adresse_Ort: string | null;
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

interface ResolvedAddress {
  strasse: string;
  hausnr: string;
  plz: string;
  ort: string;
  display: string;
}

function parseLieferadresse(s: string | null): { strasse: string; hausnr: string; plz: string; ort: string } {
  if (!s) return { strasse: "", hausnr: "", plz: "", ort: "" };
  // Aus dem Cart kommt "Strasse Hausnr, PLZ" oder "Strasse Hausnr, PLZ Ort"
  const m = s.match(/^(.+?)\s+(\S+)\s*,?\s*(\d{4,5})\s*(.*)$/);
  if (m) return { strasse: m[1].trim(), hausnr: m[2].trim(), plz: m[3].trim(), ort: m[4].trim() };
  return { strasse: s, hausnr: "", plz: "", ort: "" };
}

function buildDisplay(a: { strasse: string; hausnr: string; plz: string; ort: string }): string {
  const adr = [a.strasse, a.hausnr].filter(Boolean).join(" ");
  const ort = [a.plz, a.ort].filter(Boolean).join(" ");
  return [adr, ort].filter(Boolean).join(", ");
}

async function resolveAddress(
  body: Body,
  buchung: BuchungRow,
  kunde: KundeRow | null,
): Promise<ResolvedAddress | null> {
  // 1. Body hat explizite Felder
  if (body.liefer_strasse || body.liefer_plz) {
    const a = {
      strasse: (body.liefer_strasse || "").trim(),
      hausnr: (body.liefer_hausnr || "").trim(),
      plz: (body.liefer_plz || "").trim(),
      ort: (body.liefer_ort || "").trim(),
    };
    if (a.plz) return { ...a, display: buildDisplay(a) };
  }
  // 2. Buchung.Lieferadresse vorhanden
  if (buchung.Lieferadresse) {
    const parsed = parseLieferadresse(buchung.Lieferadresse);
    if (parsed.plz) return { ...parsed, display: buchung.Lieferadresse };
  }
  // 3. Kunden-Adresse als Fallback
  if (kunde && kunde.Adresse_PLZ) {
    // Kunde.Adresse_Strasse enthaelt oft "Strasse Hausnr" zusammen — wir splitten am letzten Space
    const strasseRaw = (kunde.Adresse_Strasse || "").trim();
    const m = strasseRaw.match(/^(.+)\s+(\S+)$/);
    const strasse = m ? m[1] : strasseRaw;
    const hausnr = m ? m[2] : "";
    const a = {
      strasse,
      hausnr,
      plz: (kunde.Adresse_PLZ || "").trim(),
      ort: (kunde.Adresse_Ort || "").trim(),
    };
    return { ...a, display: buildDisplay(a) };
  }
  return null;
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

  try {
    const buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);
    const kundeId = buchung.Kunde_Link?.[0]?.id;
    const kunde = kundeId ? await getRow<KundeRow>(TABLES.Kunden, kundeId).catch(() => null) : null;

    // Adresse resolven + ggf. Distance neu berechnen
    let distKm = typeof body.distance_km === "number" && body.distance_km > 0 ? body.distance_km : 0;
    let resolvedAdr: ResolvedAddress | null = null;
    if (lieferung || abholung) {
      resolvedAdr = await resolveAddress(body, buchung, kunde);
      if (!resolvedAdr) {
        return NextResponse.json(
          {
            error: "adresse_fehlt",
            detail: "Liefer-Adresse weder im Body noch in Buchung/Kunde gefunden. Bitte Kunden-Adresse pflegen oder Liefer-Adresse explizit setzen.",
          },
          { status: 422 },
        );
      }
      if (distKm <= 0) {
        const d = await computeDistanceKm({
          strasse: resolvedAdr.strasse,
          hausnr: resolvedAdr.hausnr,
          plz: resolvedAdr.plz,
          ort: resolvedAdr.ort,
        });
        if (!d.gefunden) {
          return NextResponse.json(
            { error: "distance_failed", detail: d.details || "Strecken-Berechnung fehlgeschlagen" },
            { status: 422 },
          );
        }
        distKm = d.km;
      }
    }

    // Liefer-Preis berechnen
    const lieferpreis = lieferung && distKm > 0 ? distKm * 2 : 0;
    const abholpreis = abholung && distKm > 0 ? distKm * 2 : 0;

    // Aufbau-Preis
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

    // Notiz-Append
    const today = new Date().toISOString().slice(0, 10);
    const zusatzBlock: string[] = [];
    if (aufbau && aufbauSumme > 0) zusatzBlock.push(`Aufbau-Service: ${aufbauSumme.toFixed(2)} EUR`);
    if (lieferung) zusatzBlock.push(`Lieferung gewuenscht (${distKm} km, ${lieferpreis.toFixed(2)} EUR)`);
    if (abholung) zusatzBlock.push(`Abholung gewuenscht (${distKm} km, ${abholpreis.toFixed(2)} EUR)`);
    if (resolvedAdr) zusatzBlock.push(`Event-Adresse: ${resolvedAdr.display}`);
    const noteAppend = zusatzBlock.length > 0
      ? `\n\n--- Service-Update ${today} ---\n${zusatzBlock.join("\n")}`
      : "";
    const newNotizen = (buchung.Notizen || "") + noteAppend;

    const update: Record<string, unknown> = {
      Preis_Lieferung: lieferpreis.toFixed(2),
      Preis_Abholung: abholpreis.toFixed(2),
      Preis_Aufbau: aufbau && aufbauSumme > 0 ? aufbauSumme.toFixed(2) : "0.00",
      Aufbau_gewuenscht: aufbau ? "Ja" : "Nein",
      ...(resolvedAdr ? { Lieferadresse: resolvedAdr.display } : {}),
      ...(noteAppend ? { Notizen: newNotizen } : {}),
    };
    await updateRow(TABLES.Buchungen, buchungId, update);

    // Recalc: Anzahlung neu + Stripe-Link-Refresh
    await recalcBuchung(buchungId);

    return NextResponse.json({
      ok: true,
      preis_lieferung: lieferpreis,
      preis_abholung: abholpreis,
      preis_aufbau: aufbau ? aufbauSumme : 0,
      distance_km: distKm,
      lieferadresse: resolvedAdr?.display ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[lieferung-setzen]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
