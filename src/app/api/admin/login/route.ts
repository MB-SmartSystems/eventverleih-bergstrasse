import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 });
  }

  const token = createToken();
  setAuthCookie(token);

  return NextResponse.json({ ok: true });
}
