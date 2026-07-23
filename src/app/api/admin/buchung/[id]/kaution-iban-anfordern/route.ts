/**
 * POST /api/admin/buchung/[id]/kaution-iban-anfordern
 *
 * Für BAR (oder per Überweisung) hinterlegte Kautionen: Es gibt keinen Stripe-Hold,
 * der freigegeben werden kann — Manuel muss den Betrag manuell zurücküberweisen und
 * braucht dafür die Bankverbindung des Kunden.
 *
 * Dieser Endpoint schickt dem Kunden eine Mail mit der Bitte um IBAN + Kontoinhaber
 * und kommuniziert die 1–2-Tage-Prüffrist. Die Erstattung selbst macht Manuel manuell
 * (Banking-App), danach im Dashboard "Kaution erstatten" (no_stripe_hold-Pfad).
 *
 * Setzt nebenbei die Prüffrist (heute + 2 Tage), falls noch keine gesetzt ist, und
 * den Prüfungs-Status auf "offen". KEIN Stripe, KEIN Statuswechsel der Buchung.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { erstattungEur } from "@/lib/eventverleih/zahlung";
import { buildKautionIbanAnfordern } from "@/lib/eventverleih/mail-templates/build/uebergabe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    type Buchung = {
      id: number;
      Kaution_Soll_Eur: string | number | null;
      Ueberzahlung_Eur: string | number | null;
      Zahlungen_JSON: string | null;
      Kaution_Prueffrist_bis: string | null;
      Stripe_Kaution_PaymentIntent: string | null;
      Kunde_Link: Array<{ id: number; value: string }> | null;
    };
    type Kunde = { id: number; Vorname: string; Nachname: string; Email: string };

    const buchung = await getRow<Buchung>(TABLES.Buchungen, buchungId);
    // Zurueck geht Kaution PLUS zu viel gezahltes Geld. Nur die Kaution zu nennen war
    // der Fehler, der am 27.07. eine schriftlich zugesagte Summe unterschritten haette.
    const erstattung = erstattungEur(buchung);
    if (erstattung.gesamtEur <= 0) {
      return NextResponse.json(
        { error: "Nichts zu erstatten (weder Kaution noch Überzahlung)" },
        { status: 422 },
      );
    }
    // Bei aktivem Stripe-Hold ist eine Rück-Überweisung der falsche Weg — dann Hold freigeben.
    if (buchung.Stripe_Kaution_PaymentIntent) {
      return NextResponse.json(
        { error: "Stripe-Hold aktiv — Kaution über Hold-Freigabe erstatten, keine Überweisung nötig" },
        { status: 422 },
      );
    }

    const kundeId = buchung.Kunde_Link?.[0]?.id;
    if (!kundeId) return NextResponse.json({ error: "Kunde nicht verknüpft" }, { status: 422 });
    const kunde = await getRow<Kunde>(TABLES.Kunden, kundeId);
    if (!kunde.Email) return NextResponse.json({ error: "Kunde hat keine E-Mail-Adresse" }, { status: 422 });

    const mail = buildKautionIbanAnfordern({
      kundeName: `${kunde.Vorname} ${kunde.Nachname}`.trim(),
      kautionEur: erstattung.kautionEur,
      ueberzahlungEur: erstattung.ueberzahlungEur,
    });

    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: "kaution_iban_anfordern",
      Subject: mail.subject,
      Body: mail.body,
      Approval_Status: "Approved",
      // Jeder bewusste Klick = eigene Mail (Nachfass möglich)
      Idempotency_Key: `B${buchungId}-kaution-iban-${Date.now()}`,
    });

    // Prüffrist + Status setzen (fail-soft — Mail ist das Wichtige)
    try {
      const patch: Record<string, unknown> = { Kaution_Pruefung_Status: "offen" };
      if (!buchung.Kaution_Prueffrist_bis) {
        patch.Kaution_Prueffrist_bis = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      }
      await updateRow(TABLES.Buchungen, buchungId, patch);
    } catch (e) {
      console.error("[kaution-iban-anfordern] prueffrist-update fehlgeschlagen:", e);
    }

    return NextResponse.json({
      ok: true,
      email: kunde.Email,
      kaution_eur: erstattung.kautionEur,
      ueberzahlung_eur: erstattung.ueberzahlungEur,
      erstattung_gesamt_eur: erstattung.gesamtEur,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[kaution-iban-anfordern] failed:", msg);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
