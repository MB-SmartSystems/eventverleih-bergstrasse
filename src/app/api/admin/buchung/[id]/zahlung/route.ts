/**
 * POST /api/admin/buchung/[id]/zahlung
 * Body: {
 *   typ: "anzahlung" | "restzahlung" | "kaution",
 *   datum: "YYYY-MM-DD",
 *   betrag_eur?: number,    // optional — wenn fehlt: Soll-Wert aus Buchung
 *   methode?: "Bar" | "Ueberweisung" | "Stripe"
 * }
 *
 * Setzt das jeweilige Bezahlt_am/Hinterlegt_am-Feld + summiert Bezahlt_Eur auf +
 * dokumentiert jeden Eingang in Zahlungen_JSON (Audit-Liste).
 *
 * Bei typ=anzahlung mit ausreichender Summe (>= Soll oder explizit gesetzt) zusaetzlich
 * Status_Erweitert=Reserviert (Hart-Block).
 *
 * Status-Semantik:
 *   - Kunde-Token-Klick (vertrag-akzeptieren)  → Status_Erweitert=Bestaetigt (Soft)
 *   - Anzahlung bestaetigt (hier oder Webhook) → Status_Erweitert=Reserviert (Hart)
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { queueAnzahlungErhaltenMail } from "@/lib/eventverleih/zahlungsbestaetigung";
import { bucheEinnahme } from "@/lib/eventverleih/einnahme";

const TYPEN = new Set(["anzahlung", "restzahlung", "kaution"]);
const METHODEN = new Set(["Bar", "Ueberweisung", "PayPal", "Stripe"]);

interface ZahlungsEintrag {
  datum: string;
  typ: "anzahlung" | "restzahlung" | "kaution";
  betrag: number;
  methode: string;
  erfasst_am: string;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { typ?: string; datum?: string; betrag_eur?: number; methode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.typ || !TYPEN.has(body.typ)) {
    return NextResponse.json({ error: "invalid typ" }, { status: 400 });
  }
  if (!body.datum || !/^\d{4}-\d{2}-\d{2}$/.test(body.datum)) {
    return NextResponse.json({ error: "datum erwartet YYYY-MM-DD" }, { status: 400 });
  }
  const methode = body.methode && METHODEN.has(body.methode) ? body.methode : "Bar";
  const typ = body.typ as "anzahlung" | "restzahlung" | "kaution";

  try {
    const buchung = await getRow<{
      Anzahlung_Soll_Eur: number | string | null;
      Restzahlung_Soll_Eur: number | string | null;
      Kaution_Soll_Eur: number | string | null;
      Anzahlung_Bezahlt_Eur: number | string | null;
      Restzahlung_Bezahlt_Eur: number | string | null;
      Zahlungen_JSON: string | null;
      Anzahlung_Bezahlt_am: string | null;
    }>(TABLES.Buchungen, buchungId);

    const parseDec = (v: string | number | null | undefined): number => {
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return v;
      const n = parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };

    // Default-Betrag = Soll wenn nicht explizit angegeben
    let betrag = body.betrag_eur;
    if (betrag === undefined || betrag === null) {
      if (typ === "anzahlung") betrag = parseDec(buchung.Anzahlung_Soll_Eur);
      else if (typ === "restzahlung") betrag = parseDec(buchung.Restzahlung_Soll_Eur);
      else betrag = parseDec(buchung.Kaution_Soll_Eur);
    }
    if (!betrag || betrag <= 0) {
      return NextResponse.json({ error: "betrag_eur muss > 0 sein" }, { status: 400 });
    }

    const iso = `${body.datum}T12:00:00Z`;
    const nowIso = new Date().toISOString();

    // Zahlungs-Eintrag bauen
    const eintrag: ZahlungsEintrag = {
      datum: body.datum,
      typ,
      betrag,
      methode,
      erfasst_am: nowIso,
    };

    // Bestehende Zahlungen lesen, anhaengen
    let zahlungen: ZahlungsEintrag[] = [];
    try {
      if (buchung.Zahlungen_JSON) {
        const parsed = JSON.parse(buchung.Zahlungen_JSON);
        if (Array.isArray(parsed)) zahlungen = parsed;
      }
    } catch {
      // ignorieren — wir starten frisch
    }
    zahlungen.push(eintrag);

    // Summen pro Typ aktualisieren
    const sumByTyp = (t: ZahlungsEintrag["typ"]) =>
      zahlungen.filter((z) => z.typ === t).reduce((s, z) => s + z.betrag, 0);

    const patch: Record<string, unknown> = {
      Zahlungen_JSON: JSON.stringify(zahlungen),
    };

    if (typ === "anzahlung") {
      patch.Anzahlung_Bezahlt_am = iso;
      patch.Anzahlung_Bezahlt_Eur = sumByTyp("anzahlung");
      // Status auf Reserviert nur wenn Anzahlung erreicht oder ueberstiegen
      const anzahlungSoll = parseDec(buchung.Anzahlung_Soll_Eur);
      if (sumByTyp("anzahlung") >= anzahlungSoll && anzahlungSoll > 0) {
        patch.Status_Erweitert = "Reserviert";
      }
    } else if (typ === "restzahlung") {
      patch.Restzahlung_Bezahlt_am = iso;
      patch.Restzahlung_Bezahlt_Eur = sumByTyp("restzahlung");
    } else if (typ === "kaution") {
      patch.Kaution_Hinterlegt_am = iso;
    }

    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Einnahme nach Zuflussprinzip (Modell A) — pro erfasstem Eingang (Teilzahlungen
    // möglich → quelle mit erfasst_am eindeutig). Kaution ist kein Zufluss, wird nicht gebucht.
    if (typ === "anzahlung" || typ === "restzahlung") {
      // Marker aus fachlichem Schlüssel (Typ+Datum+Betrag) statt Zeitstempel → ein
      // Doppelklick/Retry desselben Eingangs bucht nicht doppelt.
      await bucheEinnahme({
        buchungId,
        quelle: `${typ}-${body.datum}-${betrag.toFixed(2)}`,
        betragEur: betrag,
        datum: body.datum,
        beschreibung: `${typ === "anzahlung" ? "Anzahlung" : "Restzahlung"} Buchung #${buchungId} (${methode})`,
      });
    }

    // Bestätigungs-Mail "Anzahlung erhalten" — egal ob Bar/Überweisung/Stripe.
    // Nur wenn die Anzahlung das Soll erreicht (= Status springt auf Reserviert);
    // Teilzahlungen lösen noch keine "verbindlich reserviert"-Mail aus.
    // Fail-soft: Mail-Fehler darf die erfasste Zahlung nicht in einen 500 verwandeln.
    if (typ === "anzahlung" && patch.Status_Erweitert === "Reserviert") {
      try {
        await queueAnzahlungErhaltenMail(buchungId);
      } catch (e) {
        console.error("[zahlung] Anzahlung-Bestätigung fehlgeschlagen:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      betrag_erfasst: betrag,
      summe_pro_typ: {
        anzahlung: sumByTyp("anzahlung"),
        restzahlung: sumByTyp("restzahlung"),
        kaution: sumByTyp("kaution"),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
