/**
 * GET /api/cron/termin-1h-reminder
 *
 * Kurz-Erinnerung ~1 Stunde vor Übergabe bzw. Rückgabe. Vercel-Crons können auf dem
 * Hobby-Plan nur täglich — diesen Endpoint stößt daher ein n8n-Schedule alle ~15 Min an.
 * Idempotency-Key pro Termin sorgt dafür, dass die Mail trotz häufiger Aufrufe nur EINMAL
 * rausgeht (sobald der Termin ins ~75-Min-Fenster rutscht).
 *
 * Mail läuft über die MailQueue (Approval_Status=Auto_Reply) → eve-mailqueue-poll versendet
 * sie inkl. BCC innerhalb ~1 Min.
 *
 * Auth: Header Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from "next/server";
import { listAllRows, listRows, createRow, getRow, TABLES } from "@/lib/baserow/client";
import { uebergabeOrt } from "@/lib/eventverleih/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Uebergabe_Termin: string | null;
  Rueckgabe_Termin: string | null;
  Uebergabe_Adresse: string | null;
  Lieferadresse: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

const WINDOW_MIN = 75; // Termine, die in den nächsten 75 Min beginnen

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60_000);
}

function berlinTime(iso: string): string {
  return (
    new Date(iso).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }) +
    " Uhr"
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = { pruefte: 0, mails: 0, skipped_duplicate: 0, fehler: 0 };

  try {
    const all = await listAllRows<BuchungRow>(TABLES.Buchungen);

    for (const b of all.results) {
      const status = b.Status_Erweitert?.value || "";

      // (which, terminFeld, erlaubte Stati)
      const checks: Array<{ which: "uebergabe" | "rueckgabe"; iso: string | null; ok: boolean; label: string }> = [
        {
          which: "uebergabe",
          iso: b.Uebergabe_Termin,
          ok: status === "Reserviert" || status === "Bestaetigt",
          label: "Übergabe",
        },
        {
          which: "rueckgabe",
          iso: b.Rueckgabe_Termin,
          ok: status === "In_Miete" || status === "Uebergeben",
          label: "Rückgabe",
        },
      ];

      for (const c of checks) {
        if (!c.ok || !c.iso) continue;
        const mins = minutesUntil(c.iso);
        if (mins === null || mins <= 0 || mins > WINDOW_MIN) continue;

        result.pruefte++;
        const idemKey = `B${b.id}-1h-${c.which}`;
        const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, {
          search: idemKey,
          size: 5,
        });
        if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
          result.skipped_duplicate++;
          continue;
        }

        const kundeId = b.Kunde_Link?.[0]?.id;
        if (!kundeId) continue;
        let kunde: { Vorname?: string; Nachname?: string; Email?: string };
        try {
          kunde = await getRow<{ Vorname?: string; Nachname?: string; Email?: string }>(TABLES.Kunden, kundeId);
        } catch {
          continue;
        }
        if (!kunde.Email) continue;
        const name = `${kunde.Vorname ?? ""} ${kunde.Nachname ?? ""}`.trim();
        const ort = uebergabeOrt(b, c.which);

        const body =
          `Hallo ${name},\n\n` +
          `kurze Erinnerung: Unser ${c.label}-Termin ist gleich — um ${berlinTime(c.iso)}.\n${ort}.\n\n` +
          `Bis gleich!\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

        try {
          await createRow(TABLES.MailQueue, {
            Erstellt_am: new Date().toISOString(),
            Buchung_Link: [b.id],
            Kunde_Link: [kundeId],
            Template_Key: `termin_1h_${c.which}`,
            Subject: `Gleich: Ihr ${c.label}-Termin um ${berlinTime(c.iso)}`,
            Body: body,
            Approval_Status: "Auto_Reply",
            Idempotency_Key: idemKey,
          });
          result.mails++;
        } catch (e) {
          result.fehler++;
          console.error("[termin-1h-reminder] mail-insert fehlgeschlagen:", e);
        }
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[termin-1h-reminder] failure:", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
