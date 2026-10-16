// Vercel cron (see vercel.json): pulls Windsor into Supabase, then raises alerts.
// Manual run: curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/sync
import { buildAlerts } from '@/lib/alerts';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchComments, fetchPosts, fetchProfileDays } from '@/lib/windsor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hobby-safe; a full sync takes well under this

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorised', { status: 401 });
  }
  const db = supabaseAdmin();
  const started_at = new Date().toISOString();
  const detail: Record<string, unknown> = {};
  const errors: string[] = [];

  // Each source is independent: one failing must not block the others.
  const [daysR, postsR, commentsR] = await Promise.allSettled([fetchProfileDays(), fetchPosts(), fetchComments()]);

  if (daysR.status === 'fulfilled') {
    // A lagging day comes back all-null; never let it overwrite a day we already hold.
    const rows = daysR.value.filter((d) => d.impressions != null || d.followers != null);
    const { error } = await db.from('profile_daily').upsert(rows, { onConflict: 'date,channel' });
    if (error) errors.push(`profile_daily: ${error.message}`); else detail.profile_days = rows.length;
  } else errors.push(`Windsor profiles: ${String(daysR.reason?.message ?? daysR.reason)}`);

  if (postsR.status === 'fulfilled') {
    const { error } = await db.from('posts').upsert(postsR.value.map((p) => ({ ...p, updated_at: started_at })), { onConflict: 'post_guid' });
    if (error) errors.push(`posts: ${error.message}`); else detail.posts = postsR.value.length;
  } else errors.push(`Windsor posts: ${String(postsR.reason?.message ?? postsR.reason)}`);

  if (commentsR.status === 'fulfilled') {
    const links = new Map(postsR.status === 'fulfilled' ? postsR.value.map((p) => [p.comment_key, p.link] as const) : []);
    const rows = commentsR.value.map((c) => ({ ...c, post_link: c.post_link ?? links.get(c.post_key) ?? null, updated_at: started_at }));
    const { error } = await db.from('comments').upsert(rows, { onConflict: 'comment_id' });
    if (error) errors.push(`comments: ${error.message}`); else detail.comments = rows.length;

    if (daysR.status === 'fulfilled') {
      const alerts = buildAlerts(daysR.value, rows);
      // ignoreDuplicates keeps the first created_at, so an alert fires once.
      const { error: aerr } = await db.from('alerts').upsert(alerts, { onConflict: 'id', ignoreDuplicates: true });
      if (aerr) errors.push(`alerts: ${aerr.message}`); else detail.alerts_considered = alerts.length;
    }
  } else errors.push(`Windsor comments: ${String(commentsR.reason?.message ?? commentsR.reason)}`);

  const status = errors.length === 0 ? 'ok' : errors.length < 3 ? 'partial' : 'error';
  await db.from('sync_log').insert({ job: 'windsor', status, started_at, finished_at: new Date().toISOString(), detail: { ...detail, errors } });
  return Response.json({ status, ...detail, errors }, { status: status === 'error' ? 500 : 200 });
}
