/**
 * GET /api/member/auto-login?token=XYZ
 *
 * Magic-Link-Endpoint: prueft Token, setzt Cookie, redirected zu /mein-bereich.
 *
 * Warum Route-Handler statt Page: cookies().set() in einer Server-Component-Page
 * wirft HTTP 500 in Next.js 14.2 — Cookie-Mutation ist nur in Route-Handlers oder
 * Server-Actions erlaubt. Hier ist die korrekte Stelle.
 *
 * Bei ungueltigem Token: redirect zu /mein-bereich/login?reason=invalid (Re-Send-Form).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  verifyMemberToken,
  MEMBER_COOKIE_NAME,
  TOKEN_TTL_DAYS,
} from "@/lib/eventverleih/member-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  if (!token) {
    return NextResponse.redirect(new URL("/mein-bereich/login", req.url));
  }

  const kunde = await verifyMemberToken(token);
  if (!kunde) {
    return NextResponse.redirect(
      new URL("/mein-bereich/login?reason=invalid", req.url),
    );
  }

  const res = NextResponse.redirect(new URL("/mein-bereich", req.url));
  res.cookies.set(MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: TOKEN_TTL_DAYS * 86400,
    path: "/",
  });
  return res;
}
