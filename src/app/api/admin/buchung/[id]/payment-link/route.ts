/**
 * POST /api/admin/buchung/[id]/payment-link
 *
 * Body: { type: "anzahlung" | "restzahlung", amount_eur?: number }
 *
 * Erzeugt Stripe-Payment-Link, speichert URL in Buchung.Stripe_*_Link.
 * amount_eur optional — Default: aus Buchung.Anzahlung_Soll_Eur / Restzahlung_Soll_Eur.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { createPaymentLink } from "@/lib/stripe/payment-links";
import { isAuthenticated } from "@/lib/auth";

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

  const body = await req.json().catch(() => ({}));
  const type = body.type as "anzahlung" | "restzahlung" | undefined;
  if (type !== "anzahlung" && type !== "restzahlung") {
    return NextResponse.json({ error: "type must be anzahlung|restzahlung" }, { status: 400 });
  }

  try {
    const buchung = await getRow<{
      id: number;
      Anzahlung_Soll_Eur: number | null;
      Restzahlung_Soll_Eur: number | null;
      Kunde_Link: Array<{ id: number; value: string }> | null;
      Event_datum_von: string | null;
    }>(TABLES.Buchungen, buchungId);

    const sollFeld = type === "anzahlung" ? "Anzahlung_Soll_Eur" : "Restzahlung_Soll_Eur";
    const amountEur = body.amount_eur ?? buchung[sollFeld];
    if (!amountEur || amountEur <= 0) {
      return NextResponse.json(
        { error: `${sollFeld} fehlt in Buchung — bitte vorab im Backoffice setzen oder amount_eur im Body uebergeben` },
        { status: 422 },
      );
    }

    const kundeName = buchung.Kunde_Link?.[0]?.value || "Kunde";
    const desc =
      type === "anzahlung"
        ? `Anzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`
        : `Restzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`;

    const link = await createPaymentLink({
      buchungId,
      paymentType: type,
      amountEur: Number(amountEur),
      kundeName,
      description: desc,
    });

    const updateField = type === "anzahlung" ? "Stripe_Anzahlung_Link" : "Stripe_Restzahlung_Link";
    await updateRow(TABLES.Buchungen, buchungId, { [updateField]: link.link_url });

    return NextResponse.json({ ok: true, link_url: link.link_url, link_id: link.link_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[payment-link]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
