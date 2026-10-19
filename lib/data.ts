import 'server-only';
import type { TikTokAccountDay, TikTokVideo, TrendRow } from './tiktok';
import { shiftDay } from './metrics';
import { supabaseAdmin } from './supabase';
import type { AccountDay, Alert, AudienceDemo, CityDay, NsoCreator, NsoOpening, NsoPage, Comment, CompetitorAccountDay, CompetitorItem, CompetitorPost, Media, Mention, Post, ProfileDay } from './types';

export interface DashboardData {
  days: ProfileDay[];
  posts: Post[];
  media: Media[];
  accountDays: AccountDay[];
  comments: Comment[];
  alerts: (Alert & { created_at: string })[];
  competitors: CompetitorItem[];
  mentions: Mention[];
  lastSync: { status: string; finished_at: string } | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function loadDashboard(): Promise<DashboardData> {
  const db = supabaseAdmin();
  const [d, p, m, a, c, al, co, me, s] = await Promise.all([
    db.from('profile_daily').select('date,channel,impressions,engagements,followers,posts_sent').gte('date', shiftDay(today(), -125)).order('date'),
    db.from('posts').select('*').gte('posted', shiftDay(today(), -125)),
    db.from('media').select('*').gte('posted', shiftDay(today(), -125)).order('posted_at', { ascending: false }),
    db.from('account_daily').select('*').gte('date', shiftDay(today(), -125)).order('date'),
    db.from('comments').select('*').gte('post_date', shiftDay(today(), -30)).order('likes', { ascending: false }).limit(3000),
    db.from('alerts').select('*').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).eq('dismissed', false).order('created_at', { ascending: false }).limit(20),
    db.from('competitor_items').select('*').gte('posted_on', shiftDay(today(), -30)).order('posted_on', { ascending: false }).limit(40),
    db.from('mentions').select('*').eq('done', false).gte('posted_on', shiftDay(today(), -30)).order('posted_on', { ascending: false }).limit(60),
    db.from('sync_log').select('status,finished_at').order('started_at', { ascending: false }).limit(1),
  ]);
  for (const r of [d, p, m, a, c, al, co, me, s]) if (r.error) throw new Error(r.error.message);
  return {
    days: (d.data ?? []) as ProfileDay[],
    posts: (p.data ?? []) as Post[],
    media: (m.data ?? []) as Media[],
    accountDays: (a.data ?? []) as AccountDay[],
    comments: (c.data ?? []) as Comment[],
    alerts: (al.data ?? []) as DashboardData['alerts'],
    competitors: (co.data ?? []) as CompetitorItem[],
    mentions: (me.data ?? []) as Mention[],
    lastSync: (s.data?.[0] as DashboardData['lastSync']) ?? null,
  };
}

export interface CompetitorData {
  tiktok: TikTokVideo[];
  tiktokDays: TikTokAccountDay[];
  posts: CompetitorPost[];
  accounts: CompetitorAccountDay[];
  items: CompetitorItem[];
  lastSync: { status: string; finished_at: string } | null;
}

/** The competitor page: public Instagram posts (60 days), follower snapshots, and the briefs' moves and buzz (120 days). */
export async function loadCompetitors(): Promise<CompetitorData> {
  const db = supabaseAdmin();
  const [p, a, i, s, tv, td] = await Promise.all([
    db.from('competitor_posts').select('*').gte('posted', shiftDay(today(), -120)).order('posted_at', { ascending: false }).limit(2000),
    db.from('competitor_accounts_daily').select('*').gte('date', shiftDay(today(), -90)).order('date'),
    db.from('competitor_items').select('*').or(`posted_on.gte.${shiftDay(today(), -120)},brand.ilike.%cane%`).order('posted_on', { ascending: false }).limit(200),
    db.from('sync_log').select('status,finished_at').order('started_at', { ascending: false }).limit(1),
    db.from('competitor_tiktok').select('*').gte('posted', shiftDay(today(), -120)).order('posted_at', { ascending: false }).limit(2000),
    db.from('competitor_tiktok_daily').select('*').gte('date', shiftDay(today(), -90)).order('date'),
  ]);
  for (const r of [p, a, i, s, tv, td]) if (r.error) throw new Error(r.error.message);
  return {
    tiktok: (tv.data ?? []) as TikTokVideo[],
    tiktokDays: (td.data ?? []) as TikTokAccountDay[],
    posts: (p.data ?? []) as CompetitorPost[],
    accounts: (a.data ?? []) as CompetitorAccountDay[],
    items: (i.data ?? []) as CompetitorItem[],
    lastSync: (s.data?.[0] as CompetitorData['lastSync']) ?? null,
  };
}

export interface AudienceData {
  demo: AudienceDemo[];
  accountDays: AccountDay[];
  comments: Comment[];
  mentions: Mention[];
  lastSync: { status: string; finished_at: string } | null;
}

/** Our Audience page: demographics and follower totals, 30 days of daily totals, 60 days of comments and mentions. */
export async function loadAudience(): Promise<AudienceData> {
  const db = supabaseAdmin();
  const [d, a, c, m, s] = await Promise.all([
    db.from('audience_demo').select('*'),
    db.from('account_daily').select('*').gte('date', shiftDay(today(), -30)).order('date'),
    db.from('comments').select('*').gte('post_date', shiftDay(today(), -60)).order('likes', { ascending: false }).limit(5000),
    db.from('mentions').select('*').gte('posted_on', shiftDay(today(), -60)).order('posted_on', { ascending: false }).limit(300),
    db.from('sync_log').select('status,finished_at').order('started_at', { ascending: false }).limit(1),
  ]);
  for (const r of [d, a, c, m, s]) if (r.error) throw new Error(r.error.message);
  return {
    demo: (d.data ?? []) as AudienceDemo[],
    accountDays: (a.data ?? []) as AccountDay[],
    comments: (c.data ?? []) as Comment[],
    mentions: (m.data ?? []) as Mention[],
    lastSync: (s.data?.[0] as AudienceData['lastSync']) ?? null,
  };
}

export interface NsoData {
  openings: NsoOpening[];
  creators: NsoCreator[];
  pages: NsoPage[];
  cityDays: CityDay[];
  demo: AudienceDemo[];
  mentions: Mention[];
}

export async function loadNso(): Promise<NsoData> {
  const db = supabaseAdmin();
  const [o, c, p, cd, d, m] = await Promise.all([
    db.from('nso_openings').select('*').order('opens_on', { ascending: false, nullsFirst: true }),
    db.from('nso_creators').select('*').order('followers', { ascending: false, nullsFirst: false }),
    db.from('nso_pages').select('*').order('followers', { ascending: false, nullsFirst: false }),
    db.from('audience_city_daily').select('*').order('date'),
    db.from('audience_demo').select('*').eq('dimension', 'city'),
    db.from('mentions').select('*').gte('posted_on', shiftDay(today(), -180)).order('posted_on', { ascending: false }).limit(500),
  ]);
  for (const r of [o, c, p, cd, d, m]) if (r.error) throw new Error(r.error.message);
  return {
    openings: (o.data ?? []) as NsoOpening[], creators: (c.data ?? []) as NsoCreator[], pages: (p.data ?? []) as NsoPage[],
    cityDays: (cd.data ?? []) as CityDay[], demo: (d.data ?? []) as AudienceDemo[], mentions: (m.data ?? []) as Mention[],
  };
}

export interface InspoData {
  trends: (TrendRow & { verdict: string | null })[];
  trendDates: string[];
  marks: { key: string; verdict: string; note: string | null }[];
  comments: Comment[];
  mentions: Mention[];
  tiktok: TikTokVideo[];
}

/** Inspo: the latest UK trending hashtags (with the previous day for movement), team verdicts, comments for the reply bank, creator content about us. */
export async function loadInspo(): Promise<InspoData> {
  const db = supabaseAdmin();
  const [t, mk, c, m, tv] = await Promise.all([
    db.from('tiktok_trends').select('*').gte('date', shiftDay(today(), -14)).order('date', { ascending: false }).order('rank').limit(1000),
    db.from('inspo_marks').select('key,verdict,note'),
    db.from('comments').select('*').gte('post_date', shiftDay(today(), -21)).order('likes', { ascending: false }).limit(3000),
    db.from('mentions').select('*').gte('posted_on', shiftDay(today(), -30)).order('posted_on', { ascending: false }).limit(200),
    db.from('competitor_tiktok').select('*').gte('posted', shiftDay(today(), -14)).order('plays', { ascending: false }).limit(60),
  ]);
  for (const r of [t, mk, c, m, tv]) if (r.error) throw new Error(r.error.message);
  const rows = (t.data ?? []) as (TrendRow & { verdict: string | null })[];
  return {
    trends: rows, trendDates: [...new Set(rows.map((r) => r.date))].sort().reverse(),
    marks: (mk.data ?? []) as InspoData['marks'], comments: (c.data ?? []) as Comment[], mentions: (m.data ?? []) as Mention[], tiktok: (tv.data ?? []) as TikTokVideo[],
  };
}
