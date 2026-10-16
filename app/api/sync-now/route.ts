// Same sync as the cron, for a signed-in team member pressing "Sync now".
import { isSignedIn } from '@/lib/auth';
import { runSync } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  if (!isSignedIn()) return Response.json({ status: 'error', errors: ['Sign in first'] }, { status: 401 });
  const r = await runSync();
  return Response.json(r, { status: r.status === 'error' ? 500 : 200 });
}
