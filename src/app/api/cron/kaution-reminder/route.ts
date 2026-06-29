/**
 * GET /api/cron/kaution-reminder — Vercel-Cron taeglich
 *
 *  - listet alle Buchungen mit Status ∈ {Bestaetigt, Reserviert}
 *  - Event in Fenster T-5..T-0, Kaution_Soll_Eur > 0, Kaution noch nicht als erhalten markiert
 *  - Sendet "Kaution bitte bar bei Übergabe mitbringen"-Erinnerung (kein Stripe-Link mehr)
 *
 * Stabiler Idempotency-Key B<id>-kaution_bar_auto → genau EIN Auto-Versand pro Buchung.
 *
 * Sub-Pass unten: Review-Reminder (kein eigener Cron wg. Hobby-Cron-Limit).
 *
 * Vercel-Cron-Auth via CRON_SECRET (Header Authorization: Bearer <CRON_SECRET>).
 */
import { NextRequest, NextResponse } from "next/server";
import { listAllRows, listRows, getRow, createRow, TABLES } from "@/lib/baserow/client";
import { runReviewReminder } from "@/lib/eventverleih/review-reminder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAGE_VOR_EVENT = 5;

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

function daysBetween(future: string): number {
  const d = new Date(future);
  if (isNaN(d.getTime())) return -1;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = {
    pruefte: 0,
    mails_versendet: 0,
    skipped_duplicate: 0,
    skipped_other: 0,
    fehler: 0,
    details: [] as Array<Record<string, unknown>>,
  };

  try {
    const all = await listAllRows<BuchungRow>(TABLES.Buchungen);
    const heute = new Date().toISOString().slice(0, 10);

    for (const b of all.results) {
      const status = b.Status_Erweitert?.value || "";
      if (status !== "Bestaetigt" && status !== "Reserviert") continue;
      if (b.Kaution_Hinterlegt_am) continue;
      if (!b.Event_datum_von) continue;
      const kautionSoll = parseDec(b.Kaution_Soll_Eur);
      if (kautionSoll <= 0) continue;
      const tageBis = daysBetween(b.Event_datum_von);
      if (tageBis < 0 || tageBis > TAGE_VOR_EVENT) continue;

      result.pruefte++;

      const idemKey = `B${b.id}-kaution_bar_auto`;
      const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, {
        search: idemKey,
        size: 5,
      });
      if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
        result.skipped_duplicate++;
        continue;
      }

      try {
        const kundeId = b.Kunde_Link?.[0]?.id;
        if (!kundeId) { result.skipped_other++; result.details.push({ buchung_id: b.id, skip: "no_kunde" }); continue; }
        const kunde = await getRow<{ Vorname?: string; Nachname?: string; Email?: string }>(TABLES.Kunden, kundeId);
        if (!kunde.Email) { result.skipped_other++; result.details.push({ buchung_id: b.id, skip: "no_email" }); continue; }

        const kundeName = `${kunde.Vorname ?? ""} ${kunde.Nachname ?? ""}`.trim();
        const betrag = kautionSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const subject = "Kaution zur Übergabe | Eventverleih Bergstraße";
        const mailBody =
          `Hallo ${kundeName},\n\n` +
          `zur Vorbereitung auf Ihre Übergabe in ${tageBis <= 1 ? "Kürze" : `ca. ${tageBis} Tagen`}: ` +
          `Bitte denken Sie daran, die Kaution (${betrag} EUR) bar bei der Übergabe mitzubringen.\n\n` +
          `Die Kaution erhalten Sie nach der Rückgabe ohne Schäden vollständig zurück.\n\n` +
          `Bei Fragen jederzeit per WhatsApp oder Anruf: +49 156 79521124.\n\n` +
          `Viele Grüße\nManuel Büttner — Eventverleih Bergstraße`;

        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Buchung_Link: [b.id],
          Kunde_Link: [kundeId],
          Template_Key: "kaution_bar_hinweis",
          Subject: subject,
          Body: mailBody,
          Approval_Status: "Auto_Reply",
          Idempotency_Key: idemKey,
        });
        result.mails_versendet++;
        result.details.push({ buchung_id: b.id, tage_bis: tageBis });
      } catch (e) {
        result.fehler++;
        console.error("[kaution-reminder] mail-insert fehlgeschlagen:", b.id, e);
      }
    }

    // Sub-Pass: Review-Reminder (kein eigener Cron wg. Hobby-Cron-Limit). Fail-soft.
    let review: unknown = null;
    try {
      review = await runReviewReminder();
    } catch (e) {
      console.error("[kaution-reminder] review sub-pass fehlgeschlagen:", e);
    }

    return NextResponse.json({ ok: true, heute, result, review });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[kaution-reminder] failure:", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
