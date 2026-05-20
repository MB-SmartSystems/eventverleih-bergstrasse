/**
 * POST /api/member/login-link
 *
 * Body: form-data oder JSON mit { email: string }
 *
 * Generiert/rotiert Member-Token fuer Kunden mit dieser Mail, queued Login-Link-Mail.
 * Sicherheits-Hinweis: returnt IMMER 200 (auch wenn Mail nicht in DB) — Enumeration-Schutz.
 */
import { NextRequest, NextResponse } from "next/server";
import { createRow, TABLES } from "@/lib/baserow/client";
import { generateMagicLinkForEmail } from "@/lib/eventverleih/member-auth";

export const dynamic = "force-dynamic";

async function parseEmail(req: NextRequest): Promise<string> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    return String(body.email || "").trim();
  }
  const fd = await req.formData();
  return String(fd.get("email") || "").trim();
}

export async function POST(req: NextRequest) {
  const email = await parseEmail(req);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.redirect(new URL("/mein-bereich/login?reason=invalid_email", req.nextUrl.origin), 303);
  }

  try {
    const baseUrl = req.nextUrl.origin;
    const magicLink = await generateMagicLinkForEmail(email, baseUrl);

    if (magicLink) {
      // Queue Magic-Link-Mail. Approval_Status=Auto_Reply geht direkt raus.
      const subject = "Ihr Login-Link für Mein Bereich — Eventverleih Bergstrasse";
      const body = `Hallo,

hier ist Ihr Login-Link für Mein Bereich bei Eventverleih Bergstrasse:

${magicLink}

Der Link ist 30 Tage gültig. Wenn Sie diesen Login nicht angefordert haben, ignorieren Sie diese Mail einfach.

Bei Fragen: WhatsApp +49 156 79521124 oder direkt antworten.

Mit freundlichen Gruessen
Manuel Buettner — Eventverleih Bergstrasse`;

      try {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Template_Key: "login_magic_link",
          Subject: subject,
          Body: body,
          To_Email: email,
          Approval_Status: "Auto_Reply",
          Idempotency_Key: `magic-link-${email}-${Math.floor(Date.now() / 60000)}`, // 1-Minute-Idempotency
        });
      } catch (e) {
        console.error("[login-link] MailQueue-Insert fehlgeschlagen:", e);
      }
    }

    // Immer 200 mit Bestaetigung — auch wenn Mail nicht in DB (Enumeration-Schutz)
    return NextResponse.redirect(new URL("/mein-bereich/login?reason=sent", req.nextUrl.origin), 303);
  } catch (e) {
    console.error("[login-link] error:", e);
    return NextResponse.redirect(new URL("/mein-bereich/login?reason=error", req.nextUrl.origin), 303);
  }
}
