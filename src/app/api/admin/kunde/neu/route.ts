/**
 * POST /api/admin/kunde/neu — Neuen Kunden anlegen (Plan Phase 5 C6)
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, listRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.vorname || !body.nachname) {
    return NextResponse.json({ error: "vorname + nachname required" }, { status: 400 });
  }
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  try {
    // Pre-Check: Email bereits vorhanden?
    const existing = await listRows<{ id: number; Email?: string }>(TABLES.Kunden, { search: body.email, size: 50 });
    const dup = existing.results.find((k) => (k.Email || "").toLowerCase() === body.email.toLowerCase());
    if (dup) {
      return NextResponse.json({
        error: "duplicate_email",
        detail: `Kunde mit dieser E-Mail existiert bereits (Row ${dup.id})`,
        existing_kunde_id: dup.id,
      }, { status: 409 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const kunde = await createRow<{ id: number; Kunde_ID: number }>(TABLES.Kunden, {
      Kunde_Typ: body.firma ? "Firma" : "Privat",
      Vorname: body.vorname,
      Nachname: body.nachname,
      Firma: body.firma || "",
      Email: body.email,
      Telefon: body.telefon || "",
      Adresse_Strasse: body.adresse_strasse || "",
      Adresse_PLZ: body.adresse_plz || "",
      Adresse_Ort: body.adresse_ort || "",
      Notizen: body.notizen ? `${body.notizen}\n\n(Manuell durchs Backoffice angelegt am ${today})` : `Manuell durchs Backoffice angelegt am ${today}`,
      Kunden_Status: "Aktiv",
      DSE_Akzeptiert_Version: "1.0",
      DSE_Akzeptiert_am: nowIso,
      AGB_Akzeptiert_Version: "2.0",
      AGB_Akzeptiert_am: nowIso,
      Marketing_Optin: false,
      Erstanfrage_am: today,
      Letzter_Kontakt_am: today,
      Stammkunde_Wertung: "Neu",
    });

    return NextResponse.json({ ok: true, kunde_id: kunde.id, kunde_nr: kunde.Kunde_ID });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
