import 'server-only';
import { shiftDay } from './metrics';
import { supabaseAdmin } from './supabase';
import type { AccountDay, Alert, Comment, CompetitorAccountDay, CompetitorItem, CompetitorPost, Media, Mention, Post, ProfileDay } from './types';

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
  posts: CompetitorPost[];
  accounts: CompetitorAccountDay[];
  items: CompetitorItem[];
  lastSync: { status: string; finished_at: string } | null;
}

/** The competitor page: public Instagram posts (60 days), follower snapshots, and the briefs' moves and buzz (120 days). */
export async function loadCompetitors(): Promise<CompetitorData> {
  const db = supabaseAdmin();
  const [p, a, i, s] = await Promise.all([
    db.from('competitor_posts').select('*').gte('posted', shiftDay(today(), -120)).order('posted_at', { ascending: false }).limit(2000),
    db.from('competitor_accounts_daily').select('*').gte('date', shiftDay(today(), -90)).order('date'),
    db.from('competitor_items').select('*').or(`posted_on.gte.${shiftDay(today(), -120)},brand.ilike.%cane%`).order('posted_on', { ascending: false }).limit(200),
    db.from('sync_log').select('status,finished_at').order('started_at', { ascending: false }).limit(1),
  ]);
  for (const r of [p, a, i, s]) if (r.error) throw new Error(r.error.message);
  return {
    posts: (p.data ?? []) as CompetitorPost[],
    accounts: (a.data ?? []) as CompetitorAccountDay[],
    items: (i.data ?? []) as CompetitorItem[],
    lastSync: (s.data?.[0] as CompetitorData['lastSync']) ?? null,
  };
}
