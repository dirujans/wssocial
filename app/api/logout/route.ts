import { SESSION_COOKIE } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/', req.url), { status: 303 });
  res.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return res;
}
