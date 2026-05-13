/**
 * GET /api/admin/elster/export?jahr=YYYY — CSV-Export aller Einnahmen + Ausgaben für ELSTER-EÜR
 *
 * Format: Datum;Typ;Beschreibung;Verkaeufer;Betrag;ELSTER_Zeile;AfA_relevant;AfA_Nutzungsdauer_Jahre
 * UTF-8 mit BOM (für Excel).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listRows, TABLES } from "@/lib/baserow/client";

type EinnahmeRow = {
  id: number;
  Datum: string | null;
  Beschreibung: string;
  Betrag_Eur: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

type AusgabeRow = {
  id: number;
  Datum: string | null;
  Beschreibung: string;
  Verkaeufer: string;
  Betrag_Eur: string | null;
  AfA_relevant: boolean;
  AfA_Nutzungsdauer_Jahre: string | null;
  ELSTER_Zeile_Link: Array<{ id: number; value: string }>;
};

function csvEscape(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function num(v: string | null): number {
  return parseFloat(v ?? "0") || 0;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const jahrParam = searchParams.get("jahr");
  const jahr = parseInt(jahrParam ?? String(new Date().getFullYear()), 10);
  if (!jahr || jahr < 2020 || jahr > 2100) {
    return NextResponse.json({ error: "invalid jahr" }, { status: 400 });
  }

  const [einnahmenList, ausgabenList] = await Promise.all([
    listRows<EinnahmeRow>(TABLES.Einnahmen, { size: 1000 }),
    listRows<AusgabeRow>(TABLES.Ausgaben, { size: 1000 }),
  ]);
  const einnahmen = einnahmenList.results.filter((e) => e.Datum?.startsWith(String(jahr)));
  const ausgaben = ausgabenList.results.filter((a) => a.Datum?.startsWith(String(jahr)));

  const lines: string[] = [];
  // Header
  lines.push(
    [
      "Datum",
      "Typ",
      "Beschreibung",
      "Verkaeufer",
      "Betrag_EUR",
      "ELSTER_Zeile",
      "AfA_relevant",
      "AfA_Nutzungsdauer_Jahre",
    ].join(";")
  );
  for (const e of einnahmen.slice().sort((a, b) => (a.Datum ?? "").localeCompare(b.Datum ?? ""))) {
    lines.push(
      [
        csvEscape(e.Datum?.slice(0, 10) ?? ""),
        "Einnahme",
        csvEscape(e.Beschreibung),
        "",
        num(e.Betrag_Eur).toFixed(2).replace(".", ","),
        csvEscape(e.ELSTER_Zeile_Link?.[0]?.value ?? ""),
        "",
        "",
      ].join(";")
    );
  }
  for (const a of ausgaben.slice().sort((x, y) => (x.Datum ?? "").localeCompare(y.Datum ?? ""))) {
    lines.push(
      [
        csvEscape(a.Datum?.slice(0, 10) ?? ""),
        "Ausgabe",
        csvEscape(a.Beschreibung),
        csvEscape(a.Verkaeufer),
        num(a.Betrag_Eur).toFixed(2).replace(".", ","),
        csvEscape(a.ELSTER_Zeile_Link?.[0]?.value ?? ""),
        a.AfA_relevant ? "ja" : "nein",
        csvEscape(a.AfA_Nutzungsdauer_Jahre),
      ].join(";")
    );
  }

  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elster-euer-${jahr}.csv"`,
    },
  });
}
