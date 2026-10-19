import { areasForPassword, isMasterPassword, isMasterSession, sessionCookie, signedInAreas, type Area } from '@/lib/auth';
import { AREA_INFO } from '@/lib/areas';
import { clientOf, isLocked, logAttempt } from '@/lib/authLog';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const safeNext = (n: string | null) => (n && /^\/[a-z0-9/_-]*$/i.test(n) ? n : null);

export async function POST(req: Request) {
  const form = await req.formData();
  const attempt = String(form.get('password') ?? '');
  const area = String(form.get('area') ?? '') as Area;
  const next = safeNext(String(form.get('next') ?? ''));
  const url = new URL(req.url);
  const { ipHash, device } = clientOf(req);
  const back = (error: string) => {
    const q = new URLSearchParams({ error, ...(area ? { area } : {}), ...(next ? { next } : {}) });
    return NextResponse.redirect(new URL(`/login?${q}`, url), { status: 303 });
  };

  // Five wrong passwords in 15 minutes locks this connection out for 15 minutes, right password or not.
  if (await isLocked(ipHash)) {
    await logAttempt({ ipHash, device, area: area || null, granted: [], ok: false, outcome: 'locked' });
    return back('locked');
  }
  const granted = areasForPassword(attempt);
  if (!granted.length || (area && AREA_INFO.some((a) => a.id === area) && !granted.includes(area))) {
    await logAttempt({ ipHash, device, area: area || null, granted: [], ok: false, outcome: 'wrong password' });
    return back('1');
  }
  const master = isMasterPassword(attempt);
  await logAttempt({ ipHash, device, area: area || null, granted, ok: true, outcome: master ? 'master password' : 'area password' });
  // Add to whatever this browser already had unlocked.
  const areas = [...new Set([...signedInAreas(), ...granted])];
  const dest = next ?? AREA_INFO.find((a) => a.id === (area || granted[0]))?.home ?? '/';
  const res = NextResponse.redirect(new URL(dest, url), { status: 303 });
  res.cookies.set(sessionCookie(areas, master || isMasterSession()));
  return res;
}
