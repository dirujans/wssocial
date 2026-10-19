import { areasForPassword, sessionCookie, signedInAreas, type Area } from '@/lib/auth';
import { AREA_INFO } from '@/lib/areas';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const safeNext = (n: string | null) => (n && /^\/[a-z0-9/_-]*$/i.test(n) ? n : null);

export async function POST(req: Request) {
  const form = await req.formData();
  const attempt = String(form.get('password') ?? '');
  const area = String(form.get('area') ?? '') as Area;
  const next = safeNext(String(form.get('next') ?? ''));
  const url = new URL(req.url);
  const granted = areasForPassword(attempt);
  if (!granted.length || (area && AREA_INFO.some((a) => a.id === area) && !granted.includes(area))) {
    const q = new URLSearchParams({ error: '1', ...(area ? { area } : {}), ...(next ? { next } : {}) });
    return NextResponse.redirect(new URL(`/login?${q}`, url), { status: 303 });
  }
  // Add to whatever this browser already had unlocked.
  const areas = [...new Set([...signedInAreas(), ...granted])];
  const dest = next ?? AREA_INFO.find((a) => a.id === (area || granted[0]))?.home ?? '/';
  const res = NextResponse.redirect(new URL(dest, url), { status: 303 });
  res.cookies.set(sessionCookie(areas));
  return res;
}
