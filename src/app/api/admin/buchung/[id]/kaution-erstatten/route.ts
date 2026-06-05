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
import { eurMail } from "@/lib/eventverleih/zahlung";
import { createRechnungForBuchung, findRechnungForBuchung } from "@/lib/eventverleih/rechnung";
import { kundeNameAusLink } from "@/lib/eventverleih/kunde-name";

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

    // Beleg sicherstellen (für Link in der Abschluss-Mail) — non-blocking
    let belegUrl: string | null = null;
    try {
      const existing = await findRechnungForBuchung(buchungId);
      if (existing?.url) {
        belegUrl = existing.url;
      } else {
        const r = await createRechnungForBuchung(buchungId, { sendMail: false });
        if (r.ok) belegUrl = r.url;
        else console.error("[kaution-erstatten] Beleg nicht erstellt:", r.error);
      }
    } catch (e) {
      console.error("[kaution-erstatten] Beleg-Schritt fehlgeschlagen:", e);
    }

    // Mail an Kunde
    const kundeId = buchung.Kunde_Link?.[0]?.id;
    if (kundeId) {
      let subject = "";
      let mailBody = "";
      // NICHT .value — das ist die Kunde_ID-Zahl ("Hallo 12"-Bug). Echten Namen laden.
      const kundeName = await kundeNameAusLink(buchung.Kunde_Link);
      if (action === "voll") {
        subject = `Kaution Buchung #${buchungId} — voll zurückerstattet`;
        mailBody = `Hallo ${kundeName},\n\nIch habe die Artikel geprüft — alles in Ordnung. Ihre Kaution wird in voller Höhe (${eurMail(kautionSoll)} EUR) zurückerstattet:\n\n${piId ? "- Stripe-Hold wurde freigegeben — kein Betrag wurde abgebucht." : "- Die Erstattung überweise ich Ihnen in den nächsten Werktagen."}\n\nVielen Dank für Ihre Buchung — wir freuen uns auf den nächsten Termin!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße`;
      } else if (action === "teil") {
        subject = `Kaution Buchung #${buchungId} — Teilerstattung wegen Schaden`;
        mailBody = `Hallo ${kundeName},\n\nLeider gab es bei der Prüfung der Artikel einen Schaden. Schadensbetrag: ${eurMail(schadenEur)} EUR.\n\nDamit wird ein Teil Ihrer Kaution einbehalten:\n  Kaution gesamt: ${eurMail(kautionSoll)} EUR\n  Einbehalten:    ${eurMail(schadenEur)} EUR\n  Erstattung:     ${eurMail(kautionRueckzahlungEur)} EUR\n\n${body.schaden_notiz ? `Schaden-Notiz: ${body.schaden_notiz}\n\n` : ""}${piId ? "Die Erstattung erfolgt automatisch über Stripe in den nächsten 5 Werktagen." : "Die Erstattung überweise ich Ihnen in den nächsten Werktagen."}\n\nBei Rückfragen melden Sie sich gerne per WhatsApp/Tel +49 156 79521124.\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße`;
      } else {
        subject = `Kaution Buchung #${buchungId} — kompletter Einzug wegen Schaden`;
        mailBody = `Hallo ${kundeName},\n\nbei der Prüfung der Artikel gab es einen Schaden, dessen Höhe die Kaution erreicht oder übersteigt. Daher wird die Kaution komplett einbehalten.\n\nKaution einbehalten: ${eurMail(kautionSoll)} EUR\n${body.schaden_notiz ? `\nSchaden-Notiz: ${body.schaden_notiz}\n` : ""}\nBei Rückfragen oder Klärungsbedarf melden Sie sich bitte direkt bei mir: WhatsApp/Tel +49 156 79521124.\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße`;
      }

      // Beleg-Link (alle Faelle) + Bewertungsbitte (nur bei voller Erstattung = zufriedener Kunde)
      // vor die Grußformel einsetzen, sodass es EINE saubere Abschluss-Mail bleibt.
      const reviewUrl = (process.env.GOOGLE_REVIEW_URL || "").trim();
      const belegBlock = belegUrl ? `Ihren Beleg finden Sie hier:\n${belegUrl}\n\n` : "";
      const reviewBlock =
        action === "voll" && reviewUrl
          ? `Wenn Ihnen alles gefallen hat, würde mir eine kurze Google-Bewertung sehr helfen (gern mit Foto Ihrer Feier):\n${reviewUrl}\n\n`
          : "";
      const tail = `${belegBlock}${reviewBlock}`;
      if (tail) {
        mailBody = mailBody.replace("Mit freundlichen Grüßen", `${tail}Mit freundlichen Grüßen`);
      }

      try {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Buchung_Link: [buchungId],
          Kunde_Link: [kundeId],
          Template_Key: action === "voll" ? "kaution_rueckzahlung" : action === "teil" ? "kaution_teilerstattung" : "kaution_einzug",
          Subject: subject,
          Body: mailBody,
          Approval_Status: "Auto_Reply",
          Idempotency_Key: `B${buchungId}-kaution-${action}`,
        });
      } catch (e) {
        console.error("[kaution-erstatten] mail fehlgeschlagen:", e);
      }
    }

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
