import 'server-only';
import { buildAlerts } from './alerts';
import { runApifyStep } from './apifyJobs';
import { supabaseAdmin } from './supabase';
import { fetchAccountDays, fetchAudience, fetchComments, fetchCompetitorSocial, fetchMedia, fetchPosts, fetchProfileDays } from './windsor';

export interface SyncResult { status: 'ok' | 'partial' | 'error'; errors: string[]; [k: string]: unknown }

const why = (r: PromiseRejectedResult) => String(r.reason?.message ?? r.reason);

/** Pull Windsor into Supabase and raise alerts. Each source is independent: one failing never blocks the rest. */
export async function runSync(): Promise<SyncResult> {
  const db = supabaseAdmin();
  const started_at = new Date().toISOString();
  const detail: Record<string, unknown> = {};
  const errors: string[] = [];

  const [daysR, postsR, commentsR, mediaR, accountR, rivalsR, audR] = await Promise.allSettled([
    fetchProfileDays(), fetchPosts(), fetchComments(), fetchMedia(), fetchAccountDays(), fetchCompetitorSocial(), fetchAudience(),
  ]);

  if (daysR.status === 'fulfilled') {
    // A lagging day comes back all-null; never let it overwrite a day we already hold.
    const rows = daysR.value.filter((d) => d.impressions != null || d.followers != null);
    const { error } = await db.from('profile_daily').upsert(rows, { onConflict: 'date,channel' });
    if (error) errors.push(`profile_daily: ${error.message}`); else detail.profile_days = rows.length;
  } else errors.push(`Windsor Sprout profiles: ${why(daysR)}`);

  if (postsR.status === 'fulfilled') {
    const { error } = await db.from('posts').upsert(postsR.value.map((p) => ({ ...p, updated_at: started_at })), { onConflict: 'post_guid' });
    if (error) errors.push(`posts: ${error.message}`); else detail.posts = postsR.value.length;
  } else errors.push(`Windsor Sprout posts: ${why(postsR)}`);

  if (mediaR.status === 'fulfilled') {
    const { error } = await db.from('media').upsert(mediaR.value.map((m) => ({ ...m, updated_at: started_at })), { onConflict: 'id' });
    if (error) errors.push(`media: ${error.message}`); else detail.media = mediaR.value.length;
  } else errors.push(`Windsor Instagram/TikTok media: ${why(mediaR)}`);

  if (accountR.status === 'fulfilled') {
    // Two upserts: each only updates the columns it carries, so history outside a platform's window survives.
    const { error } = await db.from('account_daily').upsert(accountR.value.metrics, { onConflict: 'date,platform' });
    const { error: ferr } = error ? { error: null } : await db.from('account_daily').upsert(accountR.value.follows, { onConflict: 'date,platform' });
    if (error || ferr) errors.push(`account_daily: ${(error ?? ferr)!.message}`); else detail.account_days = accountR.value.metrics.length;
  } else errors.push(`Windsor Instagram/TikTok daily: ${why(accountR)}`);

  if (rivalsR.status === 'fulfilled') {
    const { posts, accounts } = rivalsR.value;
    const { error } = await db.from('competitor_posts').upsert(posts.map((p) => ({ ...p, updated_at: started_at })), { onConflict: 'id' });
    const { error: aerr } = error ? { error: null } : await db.from('competitor_accounts_daily').upsert(accounts, { onConflict: 'date,handle,platform' });
    if (error || aerr) errors.push(`competitor_posts: ${(error ?? aerr)!.message}`);
    else { detail.competitor_posts = posts.length; detail.competitor_handles = accounts.length; }
  } else errors.push(`Windsor Instagram public (competitors): ${why(rivalsR)}`);

  if (audR.status === 'fulfilled') {
    const { error } = await db.from('audience_demo').upsert(audR.value, { onConflict: 'platform,dimension,key' });
    if (error) errors.push(`audience_demo: ${error.message}`); else detail.audience_rows = audR.value.length;
    // Daily city snapshot: the history behind NSO city lift (Instagram only gives today's split).
    const cities = audR.value.filter((r) => r.dimension === 'city').map((r) => ({ date: r.snapshot_date, platform: r.platform, city: r.key, followers: r.value, unit: r.unit }));
    if (cities.length) {
      const { error: cerr } = await db.from('audience_city_daily').upsert(cities, { onConflict: 'date,platform,city' });
      if (cerr) errors.push(`audience_city_daily: ${cerr.message}`);
    }
  } else errors.push(`Windsor audience: ${why(audR)}`);

  if (commentsR.status === 'fulfilled') {
    const links = new Map<string, string>();
    if (postsR.status === 'fulfilled') postsR.value.forEach((p) => p.link && links.set(p.comment_key, p.link));
    if (mediaR.status === 'fulfilled') mediaR.value.forEach((m) => m.permalink && links.set(m.comment_key, m.permalink));
    const rows = commentsR.value.map((c) => ({ ...c, post_link: c.post_link ?? links.get(c.post_key) ?? null, updated_at: started_at }));
    const { error } = await db.from('comments').upsert(rows, { onConflict: 'comment_id' });
    if (error) errors.push(`comments: ${error.message}`); else detail.comments = rows.length;

    if (daysR.status === 'fulfilled') {
      const alerts = buildAlerts(daysR.value, rows);
      // ignoreDuplicates keeps the first created_at, so an alert fires once.
      const { error: aerr } = await db.from('alerts').upsert(alerts, { onConflict: 'id', ignoreDuplicates: true });
      if (aerr) errors.push(`alerts: ${aerr.message}`); else detail.alerts_considered = alerts.length;
    }
  } else errors.push(`Windsor comments: ${why(commentsR)}`);

  // Apify scrapes (competitor TikTok, UK trends): collect finished runs, start due ones. Never fails the sync.
  try { detail.apify = await runApifyStep(); } catch (e) { errors.push(`Apify: ${(e as Error).message}`); }

  const anyOk = [daysR, postsR, commentsR, mediaR, accountR, rivalsR, audR].some((r) => r.status === 'fulfilled');
  const status: SyncResult['status'] = errors.length === 0 ? 'ok' : anyOk ? 'partial' : 'error';
  await db.from('sync_log').insert({ job: 'windsor', status, started_at, finished_at: new Date().toISOString(), detail: { ...detail, errors } });
  return { status, ...detail, errors } as SyncResult;
}
