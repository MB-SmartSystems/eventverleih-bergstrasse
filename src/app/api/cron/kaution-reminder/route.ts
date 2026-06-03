/**
 * GET /api/cron/kaution-reminder — Vercel-Cron taeglich
 *
 *  - listet alle Buchungen mit Status ∈ {Bestaetigt, Reserviert}
 *  - Event in genau T-5 Tagen, Kaution_Soll_Eur > 0, Hold noch nicht platziert
 *  - mailt den Stripe-Kaution-Hold-Link (Pre-Auth) via Helper queueKautionHoldMail
 *
 * Warum ~T-5 (nicht bei Bestaetigung): der Pre-Auth-Hold haelt nur 7 Tage
 * (mit Extended-Auth bis ~30 Tage). Bei Bestaetigung Wochen vor dem Event
 * waere der Hold laengst verfallen. ~5 Tage vorher deckt Uebergabe + Rueckgabe ab.
 * Fenster T-5..T-0 (nicht exakt T-5), damit auch Buchungen, die WENIGER als 5 Tage
 * vor dem Event bestaetigt werden, die Auto-Mail genau einmal bekommen (Idempotency-Key).
 *
 * Stabiler Idempotency-Key B<id>-kaution_hold_auto → genau EIN Auto-Versand.
 * Manueller Re-Send weiter ueber den Admin-Button (date-suffixed Key) moeglich.
 *
 * Vercel-Cron-Auth via CRON_SECRET (Header Authorization: Bearer <CRON_SECRET>).
 */
import { NextRequest, NextResponse } from "next/server";
import { listAllRows, listRows, TABLES } from "@/lib/baserow/client";
import { queueKautionHoldMail } from "@/lib/eventverleih/kaution-mail";
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
  if (expected && auth !== `Bearer ${expected}`) {
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
      if (parseDec(b.Kaution_Soll_Eur) <= 0) continue;
      // Fenster: ab T-5 bis zum Event-Tag (T-0). Frueh-Buchungen feuern am ersten Tag
      // im Fenster (T-5), Spaet-Buchungen sofort — Idempotency-Key haelt es bei genau 1 Mail.
      const tageBis = daysBetween(b.Event_datum_von);
      if (tageBis < 0 || tageBis > TAGE_VOR_EVENT) continue;

      result.pruefte++;

      // Stabiler Idempotency-Check (genau ein Auto-Versand pro Buchung)
      const idemKey = `B${b.id}-kaution_hold_auto`;
      const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, {
        search: idemKey,
        size: 5,
      });
      if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
        result.skipped_duplicate++;
        continue;
      }

      try {
        const r = await queueKautionHoldMail({ buchungId: b.id, idempotencyKey: idemKey });
        if (r.ok) {
          result.mails_versendet++;
          result.details.push({ buchung_id: b.id, reused: r.reused });
        } else {
          result.skipped_other++;
          result.details.push({ buchung_id: b.id, skip: r.reason });
        }
      } catch (e) {
        result.fehler++;
        console.error("[kaution-reminder] queue fehlgeschlagen:", b.id, e);
      }
    }

    // Sub-Pass: Review-Reminder (kein eigener Cron wg. Hobby-Cron-Limit). Fail-soft —
    // darf den Kaution-Cron nie kippen.
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
