// Vercel cron (see vercel.json): pulls Windsor into Supabase, then raises alerts.
// Manual run: curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/sync
// or press "Sync now" on the dashboard.
import { runSync } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hobby-safe; a full sync takes well under this

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorised', { status: 401 });
  }
  const r = await runSync();
  return Response.json(r, { status: r.status === 'error' ? 500 : 200 });
}
