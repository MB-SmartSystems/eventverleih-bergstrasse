/**
 * GET /api/cron/restzahlung-reminder — Vercel-Cron taeglich 07:30
 *
 * Plan Phase 5 B9:
 *  - listet alle Buchungen mit Status=Reserviert + Event in T-14/T-7/T-3
 *  - schickt Mail mit eskalierendem Wording + Stripe-Restzahlungs-Link
 *  - T-3: Telegram-Push an Manuel
 *  - Idempotency-Key pro Buchung+Stufe verhindert doppelte Mails
 *
 * Vercel-Cron Auth via CRON_SECRET (siehe vercel docs).
 */
import { NextRequest, NextResponse } from "next/server";
import { listAllRows, listRows, createRow, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BuchungRow {
  id: number;
  Buchung_ID?: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Restzahlung_Soll_Eur: string | number | null;
  Restzahlung_Bezahlt_am: string | null;
  Stripe_Restzahlung_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

const STUFEN = [
  { tage: 14, tpl: "restzahlung_T14", tone: "freundlich" as const },
  { tage: 7, tpl: "restzahlung_T7", tone: "dringender" as const },
  { tage: 3, tpl: "restzahlung_T3", tone: "letzte_mahnung" as const },
];

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

function buildMail(tone: "freundlich" | "dringender" | "letzte_mahnung", kundeName: string, restSoll: number, eventDatumVon: string, stripeLink: string | null): { subject: string; body: string } {
  const linkLine = stripeLink
    ? `Am bequemsten zahlen Sie online:\n${stripeLink}\n\n`
    : `Bitte ueberweisen Sie auf:\n   IBAN: DE84 5001 0517 5420 4742 10\n   Verwendungszweck: bitte Angebotsnummer angeben.\n\n`;
  const sig = `\n\nMit freundlichen Gruessen\nManuel Buettner — Eventverleih Bergstrasse\nTel/WhatsApp +49 156 79521124`;

  if (tone === "freundlich") {
    return {
      subject: "Erinnerung: Restzahlung Ihrer Buchung",
      body: `Hallo ${kundeName},\n\neine kurze freundliche Erinnerung: in zwei Wochen findet Ihr Event statt (${eventDatumVon}). Bitte denken Sie an die Restzahlung von ${restSoll.toFixed(2)} EUR.\n\n${linkLine}Alternativ koennen Sie auch bar oder per EC-Karte bei der Uebergabe zahlen.${sig}`,
    };
  }
  if (tone === "dringender") {
    return {
      subject: "Restzahlung Ihrer Buchung — noch eine Woche",
      body: `Hallo ${kundeName},\n\nIhr Event ist in einer Woche (${eventDatumVon}). Damit die Uebergabe reibungslos klappt, brauche ich Ihre Restzahlung von ${restSoll.toFixed(2)} EUR bitte zeitnah.\n\n${linkLine}Falls Sie planen, bar zur Uebergabe zu zahlen, geben Sie mir kurz Bescheid — dann nehme ich es so auf.${sig}`,
    };
  }
  return {
    subject: "WICHTIG: Restzahlung Ihrer Buchung — Event in 3 Tagen",
    body: `Hallo ${kundeName},\n\nIhr Event findet in 3 Tagen statt (${eventDatumVon}). Die Restzahlung von ${restSoll.toFixed(2)} EUR ist noch offen.\n\nBitte zahlen Sie heute, sonst kann ich die Uebergabe leider nicht durchfuehren. Bei Bar-Zahlung bei Uebergabe brauche ich eine WhatsApp-Bestaetigung von Ihnen, sonst gilt die Reservierung als gefaehrdet.\n\n${linkLine}${sig}`,
  };
}

export async function GET(req: NextRequest) {
  // Vercel-Cron-Auth: Header Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = {
    pruefte: 0,
    mails_versendet: 0,
    skipped_duplicate: 0,
    fehler: 0,
    details: [] as Array<Record<string, unknown>>,
  };

  try {
    const all = await listAllRows<BuchungRow>(TABLES.Buchungen);
    const heute = new Date().toISOString().slice(0, 10);

    for (const b of all.results) {
      const status = b.Status_Erweitert?.value || "";
      if (status !== "Reserviert") continue;
      if (b.Restzahlung_Bezahlt_am) continue;
      if (!b.Event_datum_von) continue;
      const restSoll = parseDec(b.Restzahlung_Soll_Eur);
      if (restSoll <= 0) continue;

      result.pruefte++;
      const tageBis = daysBetween(b.Event_datum_von);
      const stufe = STUFEN.find((s) => s.tage === tageBis);
      if (!stufe) continue;

      // Idempotency-Check via MailQueue
      const idemKey = `B${b.id}-${stufe.tpl}`;
      const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, { search: idemKey, size: 5 });
      const dup = existing.results.find((m) => m.Idempotency_Key === idemKey);
      if (dup) {
        result.skipped_duplicate++;
        continue;
      }

      const kundeId = b.Kunde_Link?.[0]?.id;
      const kundeName = b.Kunde_Link?.[0]?.value || "";
      if (!kundeId) continue;

      const mail = buildMail(stufe.tone, kundeName, restSoll, b.Event_datum_von, b.Stripe_Restzahlung_Link);

      try {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Buchung_Link: [b.id],
          Kunde_Link: [kundeId],
          Template_Key: stufe.tpl,
          Subject: mail.subject,
          Body: mail.body,
          Approval_Status: "Auto_Reply",
          Idempotency_Key: idemKey,
        });
        result.mails_versendet++;
        result.details.push({ buchung_id: b.id, stufe: stufe.tpl, restzahlung: restSoll });
      } catch (e) {
        result.fehler++;
        console.error("[restzahlung-reminder] mail-insert fehlgeschlagen:", e);
      }

      // Telegram-Push bei T-3
      if (stufe.tage === 3) {
        const notifyUrl = process.env.N8N_ANFRAGE_NOTIFY_URL || "";
        if (notifyUrl) {
          try {
            await fetch(notifyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "restzahlung_offen_T3",
                buchung_id: b.id,
                buchung_nr: b.Buchung_ID,
                kunde_name: kundeName,
                restzahlung_eur: restSoll.toFixed(2),
                event_datum: b.Event_datum_von,
                hinweis: "Restzahlung 3 Tage vor Event noch offen — letzte Mahnung an Kunde raus",
              }),
              signal: AbortSignal.timeout(5000),
            });
          } catch (e) {
            console.error("[restzahlung-reminder] telegram-notify fehlgeschlagen:", e);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, heute, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[restzahlung-reminder] failure:", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
