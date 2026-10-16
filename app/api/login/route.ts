import { passwordMatches, sessionCookie } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const attempt = String(form.get('password') ?? '');
  const url = new URL(req.url);
  if (!passwordMatches(attempt)) {
    return NextResponse.redirect(new URL('/login?error=1', url), { status: 303 });
  }
  const res = NextResponse.redirect(new URL('/', url), { status: 303 });
  res.cookies.set(sessionCookie());
  return res;
}
