import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

// Runs in the Node runtime (not edge middleware), so secret env vars are always available.
export const SESSION_COOKIE = 'ws_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function password(): string {
  const p = process.env.DASHBOARD_PASSWORD;
  if (!p) throw new Error('DASHBOARD_PASSWORD is not set in Vercel');
  return p;
}

const token = () => createHmac('sha256', password()).update('wssocial-session-v1').digest('hex');

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordMatches(attempt: string): boolean {
  return same(attempt, password());
}

export function isSignedIn(): boolean {
  const c = cookies().get(SESSION_COOKIE)?.value;
  return !!c && same(c, token());
}

export function sessionCookie() {
  return { name: SESSION_COOKIE, value: token(), httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE };
}
