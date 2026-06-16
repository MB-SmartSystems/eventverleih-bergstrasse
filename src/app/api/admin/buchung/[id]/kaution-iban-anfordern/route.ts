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

const SIGNATURE = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

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
      Kaution_Prueffrist_bis: string | null;
      Stripe_Kaution_PaymentIntent: string | null;
      Kunde_Link: Array<{ id: number; value: string }> | null;
    };
    type Kunde = { id: number; Vorname: string; Nachname: string; Email: string };

    const buchung = await getRow<Buchung>(TABLES.Buchungen, buchungId);
    const kautionSoll =
      typeof buchung.Kaution_Soll_Eur === "number"
        ? buchung.Kaution_Soll_Eur
        : parseFloat(buchung.Kaution_Soll_Eur || "0") || 0;
    if (kautionSoll <= 0) {
      return NextResponse.json({ error: "Keine Kaution hinterlegt (Kaution_Soll_Eur = 0)" }, { status: 422 });
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

    const betrag = kautionSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const mailBody = `Hallo ${kunde.Vorname} ${kunde.Nachname},

vielen Dank für die Rückgabe. Ich prüfe die Artikel in den nächsten 1–2 Tagen auf Vollständigkeit und Schäden.

Da Sie die Kaution (${betrag} EUR) in bar hinterlegt haben, überweise ich Ihnen den Betrag nach erfolgreicher Prüfung zurück. Dafür brauche ich noch Ihre Bankverbindung – bitte antworten Sie kurz auf diese E-Mail mit:

• IBAN
• Kontoinhaber

Sobald die Prüfung abgeschlossen ist (in der Regel innerhalb von 1–2 Tagen), überweise ich Ihnen die Kaution umgehend zurück.

Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${SIGNATURE}`;

    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: "kaution_iban_anfordern",
      Subject: "Rückerstattung Ihrer Kaution – Eventverleih Bergstraße",
      Body: mailBody,
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

    return NextResponse.json({ ok: true, email: kunde.Email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[kaution-iban-anfordern] failed:", msg);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
