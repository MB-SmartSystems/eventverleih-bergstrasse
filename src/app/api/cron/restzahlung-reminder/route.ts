/**
 * GET /api/cron/restzahlung-reminder — Vercel-Cron täglich 07:30
 *
 *  - listet alle Buchungen mit Status=Reserviert + Event in T-14/T-7/T-3
 *  - legt freundliche Restzahlungs-Info-Mail in MailQueue (Approval_Status=Pending)
 *  - KEIN Telegram-T-3-Push, KEINE Eskalation — Manuel sieht offene Restzahlungen
 *    morgens im /guten-morgen Schritt 3g und entscheidet pro Buchung
 *  - Idempotency-Key pro Buchung+Stufe verhindert doppelte Mails
 *
 * Vercel-Cron Auth via CRON_SECRET (siehe vercel docs).
 *
 * Sicherheits-Gate (analog Anzahlung): Pending-Mails werden vom n8n-Workflow
 * `eve-mailqueue-poll` NICHT versendet (Filter Auto_Reply|Approved). Falls
 * Restzahlung schon eingegangen aber noch nicht im Dashboard quittiert, kann
 * Manuel via Trigger-Phrase "Restzahlung [Kunde] ist da" Baserow patchen +
 * Pending-Mail canceln.
 */
import { NextRequest, NextResponse } from "next/server";
import { listAllRows, listRows, createRow, getRow, TABLES } from "@/lib/baserow/client";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { runAnzahlungReminder } from "@/lib/eventverleih/anzahlung-reminder";
import { runTerminReminder } from "@/lib/eventverleih/termin-reminder";
import { formatGermanShort } from "@/lib/eventverleih/constants";

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
  { tage: 14, tpl: "restzahlung_pre14" },
  { tage: 7, tpl: "restzahlung_pre7" },
  { tage: 3, tpl: "restzahlung_pre3" },
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

/**
 * Freundliche Restzahlungs-Erinnerung — gleicher Ton für alle 3 Stufen,
 * nur Eingangs-Satz variiert. KEINE Eskalation, KEIN "sonst keine Übergabe".
 */
function buildMail(
  tpl: string,
  kundeName: string,
  restSoll: number,
  eventDatumVon: string,
  stripeLink: string | null,
  meinBereichUrl: string | null,
): { subject: string; body: string } {
  const linkLine = stripeLink
    ? `Am bequemsten online:\n${stripeLink}\n\n`
    : `Sie können bequem online über Ihren Kundenbereich zahlen (Link unten).\n\n`;
  const memberBlock = meinBereichUrl
    ? `\nIhren aktuellen Buchungsstatus + alle Zahlungs-Links sehen Sie hier:\n${meinBereichUrl}\n`
    : "";
  const sig = `\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

  const datum = formatGermanShort(eventDatumVon);
  const betragFmt = restSoll.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let opening = "";
  if (tpl === "restzahlung_pre14") {
    opening = `in zwei Wochen ist Ihr Event (${datum}).`;
  } else if (tpl === "restzahlung_pre7") {
    opening = `Ihr Event am ${datum} ist in einer Woche.`;
  } else {
    opening = `Ihr Event am ${datum} ist in wenigen Tagen.`;
  }

  const core = `Damit die Übergabe entspannt klappt, wäre die Restzahlung von ${betragFmt} EUR vorab über den Zahlungslink gut.`;

  const pscript = `Falls die Restzahlung schon raus ist und sich nur überschnitten hat — alles gut, ignorieren Sie die Mail einfach.`;

  return {
    subject: `Kurze Erinnerung: Restzahlung Ihrer Buchung am ${datum}`,
    body: `Hallo ${kundeName},\n\n${opening}\n\n${core}\n\n${linkLine}${pscript}${memberBlock}${sig}`,
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
    skipped_bezahlt_inzwischen: 0,
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

      // Sicherheits-Pre-Check: frisches getRow direkt vor createRow.
      try {
        const fresh = await getRow<BuchungRow>(TABLES.Buchungen, b.id);
        if (fresh.Restzahlung_Bezahlt_am) {
          result.skipped_bezahlt_inzwischen++;
          continue;
        }
      } catch (e) {
        console.error("[restzahlung-reminder] pre-check getRow fehlgeschlagen:", e);
      }

      const kundeId = b.Kunde_Link?.[0]?.id;
      if (!kundeId) continue;
      let kundeName = "";
      try {
        const k = await getRow<{ Vorname?: string; Nachname?: string }>(TABLES.Kunden, kundeId);
        kundeName = `${k?.Vorname ?? ""} ${k?.Nachname ?? ""}`.trim();
      } catch (e) {
        console.error("[restzahlung-reminder] kunde-fetch fehlgeschlagen:", e);
      }
      if (!kundeName) continue;

      // Auto-Login-Link für Mein-Bereich (fail-soft)
      let meinBereichUrl: string | null = null;
      try {
        meinBereichUrl = await memberAutoLoginUrl(kundeId);
      } catch (e) {
        console.error("[restzahlung-reminder] member-token fehlgeschlagen:", e);
      }

      const mail = buildMail(stufe.tpl, kundeName, restSoll, b.Event_datum_von, b.Stripe_Restzahlung_Link, meinBereichUrl);

      try {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Buchung_Link: [b.id],
          Kunde_Link: [kundeId],
          Template_Key: stufe.tpl,
          Subject: mail.subject,
          Body: mail.body,
          Approval_Status: "Pending",
          Idempotency_Key: idemKey,
        });
        result.mails_versendet++;
        result.details.push({ buchung_id: b.id, stufe: stufe.tpl, restzahlung: restSoll });
      } catch (e) {
        result.fehler++;
        console.error("[restzahlung-reminder] mail-insert fehlgeschlagen:", e);
      }
    }

    // Hobby-Plan: kein eigener Cron — Anzahlungs-Reminder hier mit-ausführen (fail-soft)
    let anzahlung: Record<string, unknown> = {};
    try {
      anzahlung = await runAnzahlungReminder();
    } catch (e) {
      console.error("[restzahlung-reminder] anzahlung-pass fehlgeschlagen:", e);
    }

    // Sub-Pass: Termin-Erinnerung (~1 Tag vor Übergabe, inkl. Kaution-Hinweis), fail-soft
    let termin: Record<string, unknown> = {};
    try {
      termin = await runTerminReminder();
    } catch (e) {
      console.error("[restzahlung-reminder] termin-pass fehlgeschlagen:", e);
    }

    return NextResponse.json({ ok: true, heute, result, anzahlung, termin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[restzahlung-reminder] failure:", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
