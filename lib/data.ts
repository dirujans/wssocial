import 'server-only';
import { shiftDay } from './metrics';
import { supabaseAdmin } from './supabase';
import type { Alert, Comment, Post, ProfileDay } from './types';

export interface DashboardData {
  days: ProfileDay[];
  posts: Post[];
  comments: Comment[];
  alerts: (Alert & { created_at: string })[];
  lastSync: { status: string; finished_at: string } | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function loadDashboard(): Promise<DashboardData> {
  const db = supabaseAdmin();
  const [d, p, c, a, s] = await Promise.all([
    db.from('profile_daily').select('date,channel,impressions,engagements,followers,posts_sent').gte('date', shiftDay(today(), -125)).order('date'),
    db.from('posts').select('*').gte('posted', shiftDay(today(), -62)),
    db.from('comments').select('*').gte('post_date', shiftDay(today(), -14)).order('likes', { ascending: false }).limit(2000),
    db.from('alerts').select('*').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).eq('dismissed', false).order('created_at', { ascending: false }).limit(20),
    db.from('sync_log').select('status,finished_at').order('started_at', { ascending: false }).limit(1),
  ]);
  for (const r of [d, p, c, a, s]) if (r.error) throw new Error(r.error.message);
  return {
    days: (d.data ?? []) as ProfileDay[],
    posts: (p.data ?? []) as Post[],
    comments: (c.data ?? []) as Comment[],
    alerts: (a.data ?? []) as DashboardData['alerts'],
    lastSync: (s.data?.[0] as DashboardData['lastSync']) ?? null,
  };
}
