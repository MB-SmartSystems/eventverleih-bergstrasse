/**
 * POST /api/admin/buchung/[id]/uebergabe
 *
 * Body JSON: {
 *   foto_urls: string[],
 *   checkliste: Array<{ position_id: number, name: string, ok: boolean, notiz?: string }>,
 *   kaution_methode: "stripe_preauth" | "bar" | "ec" | "keine",
 *   kaution_eur?: number,            // bei stripe_preauth/bar/ec
 *   kaution_payment_intent_id?: string,  // bei stripe_preauth
 *   uebergabe_adresse?: string,
 *   uebergabe_datum?: string,        // ISO date
 *   notiz?: string,
 * }
 *
 * Setzt Status_Erweitert = "Uebergeben", speichert alle Felder.
 * Audit-Log-Eintrag wird erstellt.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateRow, createRow, getRow, listRows, listAllRows, TABLES } from "@/lib/baserow/client";
import { invalidateAvailabilityCache } from "@/lib/eventverleih/availability";
import { cancelKaution } from "@/lib/stripe/payment-links";
import { uebergabeOrt } from "@/lib/eventverleih/config";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const buchungId = parseInt(params.id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const body = await req.json();
    const fotoUrls = Array.isArray(body.foto_urls) ? body.foto_urls : [];
    const checkliste = Array.isArray(body.checkliste) ? body.checkliste : [];
    const notiz = body.notiz || "";

    const patch: Record<string, unknown> = {
      Status_Erweitert: "Uebergeben",
      Uebergabe_Foto_URLs: JSON.stringify(fotoUrls),
      Uebergabe_Checkliste_JSON: JSON.stringify(checkliste),
      Uebergabe_Datum: body.uebergabe_datum || new Date().toISOString().slice(0, 10),
    };
    if (body.uebergabe_adresse) patch.Uebergabe_Adresse = body.uebergabe_adresse;
    if (body.kaution_payment_intent_id) {
      patch.Stripe_Kaution_PaymentIntent = body.kaution_payment_intent_id;
    }
    if (body.kaution_eur && body.kaution_methode && body.kaution_methode !== "keine") {
      patch.Kaution_Hinterlegt_am = new Date().toISOString().slice(0, 10);
    }

    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Sicherung: Kaution bar/keine genommen, aber ein Stripe-Hold liegt noch auf der Karte
    // → Hold freigeben (kein Doppel-Block beim Kunden). Fail-soft.
    if (body.kaution_methode === "bar" || body.kaution_methode === "keine") {
      try {
        const cur = await getRow<{ Stripe_Kaution_PaymentIntent: string | null }>(TABLES.Buchungen, buchungId);
        if (cur.Stripe_Kaution_PaymentIntent) {
          await cancelKaution(cur.Stripe_Kaution_PaymentIntent);
          await updateRow(TABLES.Buchungen, buchungId, { Stripe_Kaution_PaymentIntent: null });
        }
      } catch (e) {
        console.error("[uebergabe] stripe-hold-cancel fehlgeschlagen:", e);
      }
    }

    // Audit-Log-Eintrag
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Uebergabe Buchung #${buchungId}`,
        Aktion: "Uebergabe",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          methode: body.kaution_methode,
          kaution_eur: body.kaution_eur,
          foto_count: fotoUrls.length,
          checkliste_count: checkliste.length,
          notiz,
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[uebergabe audit-log]", e);
    }

    // "Übergabe erfolgt"-Mail an den Kunden (Auto_Reply, idempotent), inkl. Artikelliste
    // + Kaution-Status (bar erhalten / hinterlegt / bitte noch zahlen). Fail-soft.
    try {
      const b = await getRow<{
        Kaution_Soll_Eur: string | number | null;
        Kaution_Hinterlegt_am: string | null;
        Stripe_Kaution_Link: string | null;
        Rueckgabe_Termin: string | null;
        Uebergabe_Adresse: string | null;
        Lieferadresse: string | null;
        Preis_Lieferung: string | null;
        Preis_Abholung: string | null;
        Kunde_Link: Array<{ id: number; value: string }> | null;
      }>(TABLES.Buchungen, buchungId);
      const kundeId = b.Kunde_Link?.[0]?.id;
      const idemKey = `B${buchungId}-uebergabe_erfolgt`;
      if (kundeId) {
        const kunde = await getRow<{ Vorname?: string; Nachname?: string; Email?: string }>(TABLES.Kunden, kundeId);
        const dup = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, { search: idemKey, size: 5 });
        const alreadySent = dup.results.find((m) => m.Idempotency_Key === idemKey);
        if (kunde.Email && !alreadySent) {
          const [posAll, artAll] = await Promise.all([
            listAllRows<{ id: number; Anzahl: string | null; Artikel_Link: Array<{ id: number }> | null; Buchung_Link: Array<{ id: number }> | null }>(TABLES.Buchungs_Position),
            listAllRows<{ id: number; Bezeichnung: string }>(TABLES.Artikel),
          ]);
          const nameById = new Map(artAll.results.map((a) => [a.id, a.Bezeichnung]));
          const lines = posAll.results
            .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
            .map((p) => `- ${parseFloat(p.Anzahl ?? "1") || 1}× ${nameById.get(p.Artikel_Link?.[0]?.id ?? 0) ?? "Artikel"}`);

          const kautionSoll = parseFloat(String(b.Kaution_Soll_Eur ?? "0")) || 0;
          const eur = (n: number) => n.toFixed(2).replace(".", ",");
          let kautionLine = "";
          if (kautionSoll > 0) {
            if (body.kaution_methode === "bar" && Number(body.kaution_eur) > 0) {
              kautionLine = `\n\nDie Kaution (${eur(kautionSoll)} EUR) habe ich bar erhalten — Sie bekommen sie nach der Rückgabe vollständig zurück.`;
            } else if (body.kaution_methode === "stripe_preauth" || b.Kaution_Hinterlegt_am) {
              kautionLine = `\n\nIhre Kaution (${eur(kautionSoll)} EUR) ist als Vormerkung hinterlegt — sie wird nach der Rückgabe ohne Schäden automatisch wieder aufgelöst.`;
            } else {
              const link = (b.Stripe_Kaution_Link || "").trim();
              kautionLine = `\n\nBitte denken Sie noch an die Kaution (${eur(kautionSoll)} EUR) — Sie bekommen sie nach der Rückgabe vollständig zurück.${link ? `\nAm einfachsten hier hinterlegen:\n${link}` : ""}`;
            }
          }

          const rt = b.Rueckgabe_Termin
            ? new Date(b.Rueckgabe_Termin).toLocaleString("de-DE", {
                timeZone: "Europe/Berlin",
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }) + " Uhr"
            : null;
          const rueckgabeLine = rt
            ? `\n\nRückgabe-Termin: ${rt} (${uebergabeOrt(b, "rueckgabe")}).`
            : `\n\nDen Rückgabe-Termin halten wir wie besprochen fest.`;

          const kundeName = `${kunde.Vorname ?? ""} ${kunde.Nachname ?? ""}`.trim();
          const mailBody = `Hallo ${kundeName},\n\nIhre Mietartikel sind übergeben:\n${lines.join("\n")}${kautionLine}${rueckgabeLine}\n\nViel Freude bei Ihrer Feier!\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

          await createRow(TABLES.MailQueue, {
            Erstellt_am: new Date().toISOString(),
            Buchung_Link: [buchungId],
            Kunde_Link: [kundeId],
            Template_Key: "uebergabe_erfolgt",
            Subject: "Übergabe erfolgt — Ihre Mietartikel",
            Body: mailBody,
            Approval_Status: "Auto_Reply",
            Idempotency_Key: idemKey,
          });
        }
      }
    } catch (e) {
      console.error("[uebergabe mail]", e);
    }

    invalidateAvailabilityCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
