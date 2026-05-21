/**
 * POST /api/admin/buchung/[id]/kaution-mail
 *
 * Erzeugt eine Stripe-Checkout-Session mit capture_method=manual (Kaution-Hold)
 * und sendet dem Kunden eine Mail mit dem Hold-Link. Der Kunde klickt, hinterlegt
 * die Karte — Stripe blockiert den Betrag, bucht nichts ab. Webhook
 * `payment_intent.amount_capturable_updated` setzt Buchung.Stripe_Kaution_PaymentIntent
 * und Kaution_Hinterlegt_am.
 *
 * Idempotenz: Wenn schon ein Stripe_Kaution_Link existiert UND noch kein
 * Kaution_Hinterlegt_am, wird der bestehende Link wiederverwendet und nochmal
 * gemailt. Wenn Hold schon platziert → 409, kein Re-Send.
 *
 * Body (optional): { amount_eur?: number }  — sonst Kaution_Soll_Eur.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { createKautionCheckoutSession } from "@/lib/stripe/payment-links";
import { isAuthenticated } from "@/lib/auth";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";

export const dynamic = "force-dynamic";

type BuchungRow = {
  id: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Stripe_Kaution_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Email: string;
};

function parseDec(v: string | number | null | undefined): number {
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

  let body: { amount_eur?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);

    if (buchung.Kaution_Hinterlegt_am) {
      return NextResponse.json(
        {
          error: "kaution_bereits_hinterlegt",
          detail: `Kaution-Hold ist bereits platziert (${buchung.Kaution_Hinterlegt_am}). Kein erneuter Versand.`,
        },
        { status: 409 },
      );
    }

    const amount = body.amount_eur ?? parseDec(buchung.Kaution_Soll_Eur);
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Kaution_Soll_Eur fehlt oder ist 0 — bitte amount_eur uebergeben oder Buchung pflegen" },
        { status: 422 },
      );
    }

    const kundeId = buchung.Kunde_Link?.[0]?.id;
    if (!kundeId) {
      return NextResponse.json({ error: "Kunde nicht verknuepft" }, { status: 422 });
    }
    const kunde = await getRow<KundeRow>(TABLES.Kunden, kundeId);
    if (!kunde.Email) {
      return NextResponse.json({ error: "Kunde hat keine E-Mail-Adresse" }, { status: 422 });
    }

    // Idempotenz: wenn schon ein Link existiert und Hold noch nicht da → reuse
    let kautionUrl = (buchung.Stripe_Kaution_Link || "").trim();
    let reused = false;
    if (kautionUrl) {
      reused = true;
    } else {
      const kundeName = `${kunde.Vorname} ${kunde.Nachname}`.trim() || "Kunde";
      const session = await createKautionCheckoutSession({
        buchungId,
        amountEur: Number(amount),
        kundeName,
      });
      kautionUrl = session.url;
      await updateRow(TABLES.Buchungen, buchungId, { Stripe_Kaution_Link: kautionUrl });
    }

    // Mein-Bereich-Link mit beilegen — Kunde kann den Hold-Status auch dort einsehen
    let meinBereichUrl = "";
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[kaution-mail] memberAutoLoginUrl fehlgeschlagen:", e);
    }

    const greeting = `Hallo ${kunde.Vorname} ${kunde.Nachname}`;
    const amountFmt = amount.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const memberBlock = meinBereichUrl
      ? `\n\nMein Bereich (Buchungs-Status + Zahlungen + Rechnungen):\n${meinBereichUrl}`
      : "";

    const subject = "Kaution hinterlegen | Eventverleih Bergstrasse";
    const mailBody = `${greeting},

vor der Uebergabe brauchen wir Ihre Kaution als Sicherheit. **Wir buchen die Kaution NICHT ab** — Stripe blockiert den Betrag nur auf Ihrer Karte (sogenannte Pre-Authorization). Bei Rueckgabe ohne Schaeden wird der Hold automatisch aufgeloest, es fliesst kein Geld.

Kautions-Betrag: ${amountFmt} EUR

Bitte hier hinterlegen:
${kautionUrl}

Wichtiges in Kuerze:
  * Karte wird gepruft + Betrag vorgemerkt (kein Abbuchen)
  * Hold ist standardmaessig 7 Tage aktiv. Bei Visa/Mastercard verlaengert Stripe ggf. auf bis zu 30 Tage automatisch.
  * Bei Rueckgabe ohne Schaeden: Aufloesung des Holds in der Regel innerhalb 1-3 Werktagen.
  * Falls Ihre Karte keine Pre-Authorization unterstuetzt: einfach auf diese Mail antworten, dann nehmen wir die Kaution bei Uebergabe in bar.${memberBlock}

Bei Fragen jederzeit per WhatsApp oder Anruf erreichbar: +49 156 79521124.

Mit freundlichen Gruessen
Manuel Buettner

Eventverleih Bergstrasse
Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach Paragraph 19 Abs. 1 UStG.`;

    // Idempotenz-Key inkl. Datum, damit mehrfaches Senden (Reminder) erlaubt ist
    const today = new Date().toISOString().slice(0, 10);
    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: "kaution_hold_link",
      Subject: subject,
      Body: mailBody,
      Approval_Status: "Auto_Reply",
      Idempotency_Key: `B${buchungId}-kaution_hold_link-${today}`,
    });

    return NextResponse.json({
      ok: true,
      link_url: kautionUrl,
      reused,
      mail_queued: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[kaution-mail]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
