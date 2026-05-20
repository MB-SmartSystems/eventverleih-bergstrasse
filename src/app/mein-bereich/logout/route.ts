import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE_NAME } from "@/lib/eventverleih/member-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
  res.cookies.delete(MEMBER_COOKIE_NAME);
  return res;
}
