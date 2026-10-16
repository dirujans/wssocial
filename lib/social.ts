// Pure functions for the social-first views. No I/O.
import { shiftDay, type ChannelFilter, type Period } from './metrics';
import type { AccountDay, Channel, Comment, Media, Post } from './types';

/* ---------- Shares, saves, reposts toplines (native Instagram + TikTok) ---------- */

export type SocialMetric = 'shares' | 'saves' | 'reposts' | 'views' | 'follows';

/** Newest day where Instagram UK and TikTok both have views (TikTok fills a day or two late). */
export function lastSocialDay(rows: AccountDay[]): string | null {
  const latest = (p: AccountDay['platform']) => rows.filter((r) => r.platform === p && (r.views ?? 0) > 0).map((r) => r.date).sort().pop() ?? null;
  const ig = latest('Instagram'), tt = latest('TikTok');
  if (!ig && !tt) return null;
  if (!ig) return tt; if (!tt) return ig;
  return ig < tt ? ig : tt;
}

const platformsFor = (c: ChannelFilter): AccountDay['platform'][] | null =>
  c === 'All' ? ['Instagram', 'Instagram IE', 'TikTok'] : c === 'Instagram' ? ['Instagram', 'Instagram IE'] : c === 'TikTok' ? ['TikTok'] : null;

export interface Topline {
  metric: SocialMetric;
  current: number;
  previous: number;
  change: number | null;
  series: { date: string; value: number }[]; // current window, one point a day
  byPlatform: { platform: string; value: number }[];
  note?: string;
}

export function socialToplines(rows: AccountDay[], media: Media[], period: Period, channel: ChannelFilter): { toplines: Topline[]; from: string; to: string } | null {
  const last = lastSocialDay(rows);
  const plats = platformsFor(channel);
  if (!last || !plats) return null;
  const from = shiftDay(last, -(period - 1)), prevTo = shiftDay(last, -period), prevFrom = shiftDay(last, -(2 * period - 1));
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const scoped = rows.filter((r) => plats.includes(r.platform));
  const ttMedia = media.filter((m) => m.platform === 'TikTok' && plats.includes('TikTok'));

  const daily = (m: SocialMetric, day: string) => {
    let v = scoped.filter((r) => r.date === day).reduce((s, r) => s + (r[m === 'follows' ? 'follows' : m] ?? 0), 0);
    // TikTok gives saves per video, not per day: count them on the day the video went out.
    if (m === 'saves') v += ttMedia.filter((x) => x.posted === day).reduce((s, x) => s + (x.saves ?? 0), 0);
    return v;
  };
  const sum = (m: SocialMetric, a: string, b: string) => {
    let t = 0;
    for (let d = a; d <= b; d = shiftDay(d, 1)) t += daily(m, d);
    return t;
  };
  const metrics: SocialMetric[] = ['shares', 'saves', 'reposts', 'views', 'follows'];
  const toplines = metrics.map((m) => {
    const current = sum(m, from, last), previous = sum(m, prevFrom, prevTo);
    const series: Topline['series'] = [];
    for (let d = from; d <= last; d = shiftDay(d, 1)) series.push({ date: d, value: daily(m, d) });
    const byPlatform = plats.map((p) => ({
      platform: p,
      value: scoped.filter((r) => r.platform === p && inRange(r.date, from, last)).reduce((s, r) => s + (r[m] ?? 0), 0)
        + (m === 'saves' && p === 'TikTok' ? ttMedia.filter((x) => inRange(x.posted, from, last)).reduce((s, x) => s + (x.saves ?? 0), 0) : 0),
    })).filter((x) => x.value > 0);
    const t: Topline = { metric: m, current, previous, change: previous ? current / previous - 1 : null, series, byPlatform };
    if (m === 'reposts') t.note = 'Instagram only: TikTok does not report reposts';
    if (m === 'saves' && plats.includes('TikTok')) t.note = 'Instagram daily saves plus TikTok saves on videos posted in the period';
    return t;
  });
  return { toplines, from, to: last };
}

/* ---------- Post leaderboard ---------- */

export type PostSort = 'shares' | 'saves' | 'views' | 'engagement' | 'follows' | 'newest';

export const engagementOf = (m: Media) => (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0) + (m.reposts ?? 0);
export const engagementRateOf = (m: Media) => (m.views ? engagementOf(m) / m.views : null);

export function sortMedia(list: Media[], by: PostSort): Media[] {
  const key = (m: Media): number =>
    by === 'shares' ? m.shares ?? 0 : by === 'saves' ? m.saves ?? 0 : by === 'views' ? m.views ?? 0
      : by === 'engagement' ? engagementRateOf(m) ?? 0 : by === 'follows' ? m.new_followers ?? 0 : +new Date(m.posted_at);
  return list.slice().sort((a, b) => key(b) - key(a));
}

/** Share rate relative to the median of the same platform: what made people pass it on. */
export function shareMultiple(m: Media, all: Media[]): number | null {
  const peers = all.filter((x) => x.platform === m.platform && (x.views ?? 0) > 0).map((x) => (x.shares ?? 0) / (x.views as number)).sort((a, b) => a - b);
  if (peers.length < 5 || !m.views) return null;
  const med = peers[Math.floor(peers.length / 2)];
  return med ? (m.shares ?? 0) / m.views / med : null;
}

/* ---------- Weekly output ---------- */

/** Monday of the ISO week containing d (UTC). */
export function weekStart(d: string): string {
  const t = new Date(d + 'T00:00:00Z');
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

export interface WeekRow { channel: Channel; thisWeek: number; lastWeekSameDays: number; lastWeek: number; weekBefore: number; stories: number; storiesLastWeek: number }

export function weeklyOutput(posts: Post[], today: string): { rows: WeekRow[]; thisWeekFrom: string; daysIn: number; lastWeekFrom: string } {
  const thisWeekFrom = weekStart(today);
  const daysIn = Math.round((+new Date(today + 'T00:00:00Z') - +new Date(thisWeekFrom + 'T00:00:00Z')) / 864e5) + 1;
  const lastWeekFrom = shiftDay(thisWeekFrom, -7), weekBeforeFrom = shiftDay(thisWeekFrom, -14);
  const count = (c: Channel, a: string, b: string, story?: boolean) =>
    posts.filter((p) => p.channel === c && p.posted >= a && p.posted <= b && (story === undefined ? true : story ? p.format === 'Story' : p.format !== 'Story')).length;
  const channels: Channel[] = ['TikTok', 'Instagram', 'Facebook', 'LinkedIn', 'X'];
  const rows = channels.map((c) => ({
    channel: c,
    thisWeek: count(c, thisWeekFrom, today, false),
    lastWeekSameDays: count(c, lastWeekFrom, shiftDay(lastWeekFrom, daysIn - 1), false),
    lastWeek: count(c, lastWeekFrom, shiftDay(thisWeekFrom, -1), false),
    weekBefore: count(c, weekBeforeFrom, shiftDay(lastWeekFrom, -1), false),
    stories: count(c, thisWeekFrom, today, true),
    storiesLastWeek: count(c, lastWeekFrom, shiftDay(thisWeekFrom, -1), true),
  })).filter((r) => r.thisWeek + r.lastWeek + r.weekBefore + r.stories + r.storiesLastWeek > 0);
  return { rows, thisWeekFrom, daysIn, lastWeekFrom };
}

/** Posts per week per channel (feed and video, not stories), for the last n weeks. */
export function weeklyHistory(posts: Post[], today: string, weeks = 8): { week: string; [channel: string]: number | string }[] {
  const start = shiftDay(weekStart(today), -7 * (weeks - 1));
  const out: { week: string; [channel: string]: number | string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const a = shiftDay(start, 7 * w), b = shiftDay(a, 6);
    const row: { week: string; [channel: string]: number | string } = { week: a };
    for (const p of posts) if (p.format !== 'Story' && p.posted >= a && p.posted <= b) row[p.channel] = ((row[p.channel] as number) ?? 0) + 1;
    out.push(row);
  }
  return out;
}

/* ---------- Stories doing well ---------- */

export interface StoryPick { post: Post; multiple: number | null; replyRate: number | null }

/** This week's and last week's Instagram stories, ranked, each compared with the median story of the 28 days before. */
export function standoutStories(posts: Post[], today: string): { picks: StoryPick[]; median: number | null } {
  const stories = posts.filter((p) => p.format === 'Story' && p.channel === 'Instagram');
  const recentFrom = shiftDay(today, -7);
  const base = stories.filter((p) => p.posted < recentFrom && p.posted >= shiftDay(recentFrom, -28) && (p.impressions ?? 0) > 0).map((p) => p.impressions as number).sort((a, b) => a - b);
  const median = base.length >= 5 ? base[Math.floor(base.length / 2)] : null;
  const picks = stories
    .filter((p) => p.posted >= recentFrom && (p.impressions ?? 0) > 0)
    .map((p) => ({ post: p, multiple: median ? (p.impressions as number) / median : null, replyRate: p.impressions ? (p.comments ?? 0) / (p.impressions as number) : null }))
    .sort((a, b) => (b.post.impressions ?? 0) - (a.post.impressions ?? 0));
  return { picks, median };
}

/* ---------- Comment ranking ---------- */

export type CommentRank = 'hot' | 'liked' | 'reply' | 'newest';

/** Someone is waiting for us: a question or pushback with no reply yet (Instagram shows replies; TikTok does not). */
export const needsReply = (c: Comment) =>
  (c.theme === 'Pushback' || /\?\s*$|\?\s|\bhow\b|\bwhen\b|\bwhere\b|\bwhy\b/i.test(c.text)) && (c.replies == null || c.replies === 0);

const THEME_WEIGHT: Record<string, number> = { Pushback: 40, "Where's ours?": 18, 'Wants in': 8, Love: 6, 'Tagging a friend': 0, Other: 0 };

/** Heat: likes, then replies, then urgency, fading over a week. */
export function heat(c: Comment, now = Date.now()): number {
  const at = c.commented_at ? +new Date(c.commented_at) : +new Date(c.post_date + 'T12:00:00Z');
  const ageDays = Math.max(0, (now - at) / 864e5);
  const fresh = Math.max(0.35, 1 - ageDays / 10);
  return (c.likes + (c.replies ?? 0) * 3 + (THEME_WEIGHT[c.theme] ?? 0) + (needsReply(c) ? 10 : 0)) * fresh;
}

export function rankComments(list: Comment[], by: CommentRank, now = Date.now()): Comment[] {
  const at = (c: Comment) => (c.commented_at ? +new Date(c.commented_at) : +new Date(c.post_date + 'T00:00:00Z'));
  const l = by === 'reply' ? list.filter(needsReply) : list.slice();
  return l.sort((a, b) => (by === 'hot' ? heat(b, now) - heat(a, now) : by === 'liked' || by === 'reply' ? b.likes - a.likes : at(b) - at(a)));
}
