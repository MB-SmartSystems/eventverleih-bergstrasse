import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

const COOKIE_NAME = 'eventverleih-admin';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function getSecret(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('ADMIN_PASSWORD not set');
  return pw;
}

export function createToken(): string {
  const secret = getSecret();
  const payload = `admin:${Date.now()}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

export function verifyToken(token: string): boolean {
  const secret = getSecret();
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}:${parts[1]}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return sig === parts[2];
}

export function setAuthCookie(token: string): void {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function clearAuthCookie(): void {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function isAuthenticated(): boolean {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export function checkPassword(password: string): boolean {
  return password === process.env.ADMIN_PASSWORD;
}
