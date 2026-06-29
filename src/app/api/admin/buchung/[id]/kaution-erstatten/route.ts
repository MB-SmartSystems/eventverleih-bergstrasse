/**
 * POST /api/admin/buchung/[id]/kaution-erstatten
 *
 * Body: { action: "voll" | "teil" | "einzug", schaden_eur?: number, schaden_notiz?: string }
 *
 * Plan Phase 5 B7: Kaution-Pruefphase 1-2 Werktage. Manuel pruft Artikel nach Rueckgabe und
 * loest dann die Kaution auf:
 *   - voll:   Kaution voll zurueck → Stripe cancel(PaymentIntent) wenn Hold, sonst Status-Update
 *   - teil:   Schaden eingezogen, Rest zurueck → Stripe capture(schaden_eur)
 *   - einzug: Kompletter Einzug (Schaden >= Kaution) → Stripe capture(full)
 *
 * Mail an Kunde mit Status + optional Schaden-Notiz + Foto.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, createRow, updateRow, TABLES } from "@/lib/baserow/client";
import { captureKaution, cancelKaution } from "@/lib/stripe/payment-links";
import { createRechnungForBuchung, findRechnungForBuchung } from "@/lib/eventverleih/rechnung";
import { bucheEinnahme } from "@/lib/eventverleih/einnahme";

export const dynamic = "force-dynamic";

interface BuchungData {
  id: number;
  Stripe_Kaution_PaymentIntent: string | null;
  Kaution_Soll_Eur: number | string | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { action?: string; schaden_eur?: number; schaden_notiz?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.action || !["voll", "teil", "einzug"].includes(body.action)) {
    return NextResponse.json({ error: "action must be voll|teil|einzug" }, { status: 400 });
  }
  const action = body.action as "voll" | "teil" | "einzug";

  try {
    const buchung = await getRow<BuchungData>(TABLES.Buchungen, buchungId);
    const kautionSoll = parseDec(buchung.Kaution_Soll_Eur);
    const piId = buchung.Stripe_Kaution_PaymentIntent;
    const heute = new Date().toISOString().slice(0, 10);

    let kautionRueckzahlungEur = 0;
    let schadenEur = 0;
    let stripeAction = "";

    if (action === "voll") {
      kautionRueckzahlungEur = kautionSoll;
      schadenEur = 0;
      if (piId) {
        try {
          await cancelKaution(piId);
          stripeAction = "cancel";
        } catch (e) {
          console.error("[kaution-erstatten] cancel fehlgeschlagen:", e);
          // Stripe-Fehler NICHT verschlucken: sonst wuerde unten "abgeschlossen" gesetzt
          // + "Kaution kommt zurueck"-Mail verschickt, obwohl der Hold nie freigegeben wurde.
          return NextResponse.json({ error: "stripe_kaution_fehler", action, detail: String(e).slice(0, 200) }, { status: 502 });
        }
      } else {
        stripeAction = "no_stripe_hold";
      }
    } else if (action === "teil") {
      schadenEur = parseDec(body.schaden_eur);
      if (schadenEur <= 0 || schadenEur >= kautionSoll) {
        return NextResponse.json({ error: "schaden_eur muss > 0 und < kaution_soll sein" }, { status: 400 });
      }
      kautionRueckzahlungEur = kautionSoll - schadenEur;
      if (piId) {
        try {
          await captureKaution(piId, schadenEur);
          stripeAction = `capture_${schadenEur.toFixed(2)}`;
        } catch (e) {
          console.error("[kaution-erstatten] capture (teil) fehlgeschlagen:", e);
          return NextResponse.json({ error: "stripe_kaution_fehler", action, detail: String(e).slice(0, 200) }, { status: 502 });
        }
      } else {
        stripeAction = "no_stripe_hold";
      }
    } else if (action === "einzug") {
      schadenEur = kautionSoll;
      kautionRueckzahlungEur = 0;
      if (piId) {
        try {
          await captureKaution(piId);
          stripeAction = "capture_full";
        } catch (e) {
          console.error("[kaution-erstatten] capture (einzug) fehlgeschlagen:", e);
          return NextResponse.json({ error: "stripe_kaution_fehler", action, detail: String(e).slice(0, 200) }, { status: 502 });
        }
      } else {
        stripeAction = "no_stripe_hold";
      }
    }

    // Buchung aktualisieren
    const patch: Record<string, unknown> = {
      Kaution_Pruefung_Status: "abgeschlossen",
      Kaution_Rueckzahlung_am: heute,
      Kaution_Rueckzahlung_Eur: kautionRueckzahlungEur,
    };
    if (schadenEur > 0) {
      patch.Schaden_Betrag_Eur = schadenEur;
      patch.Schaden_Dokumentiert_am = heute;
    }
    if (body.schaden_notiz) {
      patch.Kaution_Schaden_Notiz = body.schaden_notiz;
    }
    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Audit-Log
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Kaution-Aufloesung Buchung #${buchungId}`,
        Aktion: schadenEur > 0 ? "Schaden_dokumentiert" : "Kaution_erstattet",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          action,
          kaution_soll: kautionSoll,
          schaden_eur: schadenEur,
          erstattung_eur: kautionRueckzahlungEur,
          stripe_action: stripeAction,
          notiz: body.schaden_notiz || "",
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[kaution-erstatten] audit-log fehlgeschlagen:", e);
    }

    // Beleg-Row sicherstellen (vor Einnahme-Buchung, damit rechnungId verfügbar).
    // Der Snapshot wird hier eingefroren — updateRow lief bereits → Kaution-Felder korrekt gesetzt.
    let rechnungId: number | undefined;
    try {
      const existing = await findRechnungForBuchung(buchungId);
      if (existing?.id) {
        rechnungId = existing.id;
      } else {
        const r = await createRechnungForBuchung(buchungId, { sendMail: false });
        if (r.ok) rechnungId = r.rechnung_id;
        else console.error("[kaution-erstatten] Beleg nicht erstellt:", r.error);
      }
    } catch (e) {
      console.error("[kaution-erstatten] Beleg-Schritt fehlgeschlagen:", e);
    }

    // Einbehaltener Schaden ist eine Betriebseinnahme (Schadensersatz aus Kaution) —
    // als Einnahme buchen (Zuflussprinzip). Idempotent pro Buchung über den Marker.
    if (schadenEur > 0) {
      await bucheEinnahme({
        buchungId,
        quelle: `schaden-${buchungId}`,
        betragEur: schadenEur,
        datum: heute,
        beschreibung: `Schadensersatz (Kaution) Buchung #${buchungId}`,
        rechnungId,
      });
    }

    // KEINE eigene Kunden-Mail mehr (Manuel 2026-06-24): die Kautions-Auflösung ist rein intern.
    // Die Info (Hold freigegeben / Teilerstattung / Einzug + Schaden-Notiz) steht in den oben
    // gesetzten Buchungs-Feldern (Kaution_Pruefung_Status, Kaution_Rueckzahlung_Eur,
    // Schaden_Betrag_Eur, Kaution_Schaden_Notiz) und wird von der EINEN finalen Abschluss-Mail
    // ("Rechnung erstellen + Mail senden" → n8n-Rechnungs-Workflow) aufgegriffen.

    return NextResponse.json({
      ok: true,
      action,
      schaden_eur: schadenEur,
      erstattung_eur: kautionRueckzahlungEur,
      stripe: stripeAction,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
