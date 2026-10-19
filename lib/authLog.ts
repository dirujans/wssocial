import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from './supabase';

// Wrong-password lockout and sign-in log. Serverless functions share no memory, so both live in Supabase.
export const LOCK_AFTER = 5;          // wrong passwords from one connection…
export const LOCK_WINDOW_MIN = 15;    // …within this many minutes locks that connection for the same time.

export function clientOf(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return { ipHash: createHash('sha256').update(`wssocial-ip-v1:${ip}`).digest('hex').slice(0, 16), device: deviceOf(req.headers.get('user-agent') ?? '') };
}

/** "iPhone · Safari", "Mac · Chrome": enough to recognise a device without storing the full user agent. */
export function deviceOf(ua: string): string {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  return `${os} · ${br}`;
}

/** True when this connection has had too many wrong passwords recently. Fails open if the log can't be read. */
export async function isLocked(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString();
  const { count, error } = await supabaseAdmin().from('auth_log').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('outcome', 'wrong password').gte('at', since);
  return !error && (count ?? 0) >= LOCK_AFTER;
}

export async function logAttempt(row: { ipHash: string; device: string; area: string | null; granted: string[]; ok: boolean; outcome: string }) {
  await supabaseAdmin().from('auth_log').insert({ ip_hash: row.ipHash, device: row.device, area: row.area, granted: row.granted, ok: row.ok, outcome: row.outcome }).then(() => undefined, () => undefined);
}
