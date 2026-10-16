// Team password on every page. The cron route has its own secret.
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new NextResponse('DASHBOARD_PASSWORD is not set', { status: 500 });
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    const [, pass] = atob(auth.slice(6)).split(':');
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse('Sign in required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Wingstop UK Social"' } });
}

export const config = { matcher: ['/((?!api/sync|_next/static|_next/image|favicon.ico).*)'] };
