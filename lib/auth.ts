import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Areas are unlocked separately. The master password (DASHBOARD_PASSWORD) opens all of them;
// each area password opens only its own area, so e.g. the loyalty team can see Flavour Club without seeing social data.
// Runs in the Node runtime (not edge middleware), so secret env vars are always available.
export type Area = 'social' | 'competitor' | 'nso' | 'flavour' | 'paid';
export const AREAS: Area[] = ['social', 'competitor', 'nso', 'flavour', 'paid'];
// Paid (ad spend by agency) is deliberately outside the master password: only PAID_PASSWORD opens it.
const MASTER_AREAS: Area[] = AREAS.filter((a) => a !== 'paid');
const AREA_ENV: Record<Area, string> = { social: 'SOCIAL_PASSWORD', competitor: 'COMPETITOR_PASSWORD', nso: 'NSO_PASSWORD', flavour: 'FLAVOUR_CLUB_PASSWORD', paid: 'PAID_PASSWORD' };

export const SESSION_COOKIE = 'ws_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days, then sign in again

function master(): string {
  const p = process.env.DASHBOARD_PASSWORD?.trim();
  if (!p) throw new Error('DASHBOARD_PASSWORD is not set in Vercel');
  return p;
}
// Signing key derives from the master password: changing it signs everyone out.
const key = () => createHash('sha256').update(`wssocial-session-v2:${master()}`).digest();
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url');

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Which areas a password opens: all but Paid for the master password, one for an area password, none otherwise. */
export function areasForPassword(attempt: string): Area[] {
  const a = attempt.trim();
  if (!a) return [];
  if (same(a, master())) return [...MASTER_AREAS];
  return AREAS.filter((area) => { const p = process.env[AREA_ENV[area]]?.trim(); return !!p && same(a, p); });
}

/** True when the password is the master one (used to show the access log). */
export const isMasterPassword = (attempt: string) => !!attempt.trim() && same(attempt.trim(), master());

function session(): { a: Area[]; m: boolean } | null {
  const c = cookies().get(SESSION_COOKIE)?.value;
  if (!c) return null;
  const [payload, sig] = c.split('.');
  if (!payload || !sig || !same(sig, sign(payload))) return null;
  try {
    const { a, e, m } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { a: Area[]; e: number; m?: boolean };
    if (!e || Date.now() > e) return null;
    return { a: a.filter((x) => AREAS.includes(x)), m: !!m };
  } catch { return null; }
}

/** Areas unlocked by the current session cookie. */
export const signedInAreas = (): Area[] => session()?.a ?? [];
/** Signed in with the master password at some point in this session. */
export const isMasterSession = () => !!session()?.m;

export const canView = (area: Area) => signedInAreas().includes(area);
/** Any area unlocked (used by shared actions such as Sync now). */
export const isSignedIn = (area?: Area) => (area ? canView(area) : signedInAreas().length > 0);

/** For pages: send to the right sign-in if this area isn't unlocked. */
export function requireArea(area: Area, path: string): Area[] {
  const areas = signedInAreas();
  if (!areas.includes(area)) redirect(`/login?area=${area}&next=${encodeURIComponent(path)}`);
  return areas;
}

export function sessionCookie(areas: Area[], masterSession = false) {
  const payload = Buffer.from(JSON.stringify({ a: [...new Set(areas)], e: Date.now() + MAX_AGE * 1000, ...(masterSession ? { m: true } : {}) })).toString('base64url');
  return { name: SESSION_COOKIE, value: `${payload}.${sign(payload)}`, httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: MAX_AGE };
}
