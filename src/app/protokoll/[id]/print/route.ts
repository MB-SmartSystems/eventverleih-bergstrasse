/**
 * GET /protokoll/[id]/print
 *
 * Helles, druckfertiges A4-Übergabe-/Rücknahmeprotokoll (renderProtokollHtml).
 * Admin-gated (eventverleih-admin-Cookie). Quelle = die in Baserow dokumentierten
 * Übergabe-/Rücknahme-Felder. Manuel öffnet es und speichert via Strg+P als PDF.
 */
import { NextRequest } from "next/server";
import { getRow, TABLES } from "@/lib/baserow/client";
import { isAuthenticated } from "@/lib/auth";
import { kundeNameAusLink } from "@/lib/eventverleih/kunde-name";
import { renderProtokollHtml, type ProtokollContext } from "@/lib/protokoll-html";

export const dynamic = "force-dynamic";

const FIRMA = {
  name: "Eventverleih Bergstraße",
  inhaber: "Manuel Büttner",
  anschrift: "Schlesierstraße 19a, 64665 Alsbach-Hähnlein",
  telefon: "+49 156 79521124",
  email: "info@eventverleih-bergstrasse.de",
};

interface BuchungRow {
  Buchung_ID?: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Uebergabe_Datum: string | null;
  Uebergabe_Adresse: string | null;
  Uebergabe_Foto_URLs: string | null;
  Uebergabe_Checkliste_JSON: string | null;
  Ruecknahme_Datum: string | null;
  Ruecknahme_Foto_URLs: string | null;
  Ruecknahme_Schaden_JSON: string | null;
  Schaden_Betrag_Eur: string | number | null;
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

function jsonArr<T>(s: string | null): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
function num(v: string | number | null): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("de-DE");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return new Response("unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return new Response("invalid id", { status: 400 });

  let b: BuchungRow;
  try {
    b = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);
  } catch {
    return new Response("Buchung nicht gefunden", { status: 404 });
  }

  const hasUebergabe = !!(b.Uebergabe_Datum || b.Uebergabe_Checkliste_JSON || b.Uebergabe_Foto_URLs);
  const hasRuecknahme = !!(b.Ruecknahme_Datum || b.Ruecknahme_Schaden_JSON || b.Ruecknahme_Foto_URLs);

  // NICHT Kunde_Link.value — das ist die Kunde_ID-Zahl ("Hallo 12"-Bug). Echten Namen laden.
  const kundeName = await kundeNameAusLink(b.Kunde_Link, "(unbekannt)");
  const context: ProtokollContext = {
    buchungNr: String(b.Buchung_ID || buchungId),
    kundeName,
    zeitraum: `${fmtDate(b.Event_datum_von)} – ${fmtDate(b.Event_datum_bis)}`,
    uebergabe: hasUebergabe
      ? {
          datum: fmtDate(b.Uebergabe_Datum),
          adresse: b.Uebergabe_Adresse || "",
          checkliste: jsonArr<{ name: string; ok: boolean; notiz?: string }>(b.Uebergabe_Checkliste_JSON),
          fotos: jsonArr<string>(b.Uebergabe_Foto_URLs),
        }
      : null,
    ruecknahme: hasRuecknahme
      ? {
          datum: fmtDate(b.Ruecknahme_Datum),
          schaden: jsonArr<{ beschreibung: string; betrag_eur: number }>(b.Ruecknahme_Schaden_JSON),
          schadenBetrag: num(b.Schaden_Betrag_Eur),
          fotos: jsonArr<string>(b.Ruecknahme_Foto_URLs),
        }
      : null,
    kaution: {
      soll: num(b.Kaution_Soll_Eur),
      hinterlegt: b.Kaution_Hinterlegt_am ? fmtDate(b.Kaution_Hinterlegt_am) : null,
      rueckzahlung: b.Kaution_Rueckzahlung_am ? fmtDate(b.Kaution_Rueckzahlung_am) : null,
    },
    firma: FIRMA,
    erstelltAm: new Date().toLocaleString("de-DE"),
  };

  const html = renderProtokollHtml(context);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
