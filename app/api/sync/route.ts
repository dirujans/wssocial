// Vercel cron (see vercel.json): pulls Windsor into Supabase, then raises alerts.
// ?part=core (our channels) or ?part=intel (competitors, audience, Apify); no part runs everything.
// Manual run: curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/sync
import { runSync, type SyncPart } from '@/lib/sync';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hobby-safe

export async function GET(req: Request) {
  // Trim both sides: a secret pasted with a trailing newline would otherwise silently fail every cron.
  const expected = (process.env.CRON_SECRET ?? '').trim();
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!expected || got !== expected) {
    // Leave a trace so a broken cron is visible on the dashboard, not silent.
    if (/vercel-cron/i.test(req.headers.get('user-agent') ?? '')) {
      await supabaseAdmin().from('sync_log').insert({ job: 'windsor', status: 'error', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), detail: { errors: ['Cron call rejected: CRON_SECRET mismatch'] } });
    }
    return new Response('Unauthorised', { status: 401 });
  }
  const p = new URL(req.url).searchParams.get('part');
  const part: SyncPart = p === 'core' || p === 'intel' ? p : 'all';
  const r = await runSync(part);
  return Response.json(r, { status: r.status === 'error' ? 500 : 200 });
}
