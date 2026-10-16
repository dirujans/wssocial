// Pure functions shared by the page and the alert engine. No I/O here.
import { CHANNELS, type Channel, type ProfileDay } from './types';

export type Period = 7 | 28 | 60;
export type ChannelFilter = Channel | 'All';

export const shiftDay = (d: string, n: number) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Newest date where Instagram and TikTok both report impressions (Sprout lags a day). */
export function lastCompleteDay(days: ProfileDay[]): string | null {
  const ok = (d: string, c: Channel) => days.some((r) => r.date === d && r.channel === c && r.impressions != null);
  const dates = [...new Set(days.map((r) => r.date))].sort();
  for (let i = dates.length - 1; i >= 0; i--) if (ok(dates[i], 'Instagram') && ok(dates[i], 'TikTok')) return dates[i];
  return null;
}

export interface Window { curFrom: string; curTo: string; prevFrom: string; prevTo: string }
export function windowFor(last: string, period: Period): Window {
  return { curFrom: shiftDay(last, -(period - 1)), curTo: last, prevFrom: shiftDay(last, -(2 * period - 1)), prevTo: shiftDay(last, -period) };
}

export interface Headline {
  metric: 'impressions' | 'engagements' | 'engagement_rate' | 'follower_growth';
  current: number | null;
  previous: number | null;
  /** relative change, except engagement_rate where it is the difference in rate */
  change: number | null;
}

function followersOn(days: ProfileDay[], c: Channel, d: string): number | null {
  let best: ProfileDay | null = null;
  for (const r of days) if (r.channel === c && r.date <= d && r.followers != null && (!best || r.date > best.date)) best = r;
  return best ? best.followers : null;
}

export function headlines(days: ProfileDay[], w: Window, filter: ChannelFilter): Headline[] {
  const set = filter === 'All' ? CHANNELS : [filter];
  const rows = days.filter((r) => set.includes(r.channel));
  const sum = (a: string, b: string, k: 'impressions' | 'engagements') => rows.filter((r) => r.date >= a && r.date <= b).reduce((s, r) => s + (r[k] ?? 0), 0);
  const growth = (a: string, b: string) => {
    let hit = 0, v = 0;
    for (const c of set) {
      const s = followersOn(days, c, shiftDay(a, -1)), e = followersOn(days, c, b);
      if (s != null && e != null) { hit++; v += e - s; }
    }
    return hit ? v : null;
  };
  const ci = sum(w.curFrom, w.curTo, 'impressions'), pi = sum(w.prevFrom, w.prevTo, 'impressions');
  const ce = sum(w.curFrom, w.curTo, 'engagements'), pe = sum(w.prevFrom, w.prevTo, 'engagements');
  const cg = growth(w.curFrom, w.curTo), pg = growth(w.prevFrom, w.prevTo);
  const cr = ci ? ce / ci : null, pr = pi ? pe / pi : null;
  return [
    { metric: 'impressions', current: ci, previous: pi, change: pi ? ci / pi - 1 : null },
    { metric: 'engagements', current: ce, previous: pe, change: pe ? ce / pe - 1 : null },
    { metric: 'engagement_rate', current: cr, previous: pr, change: cr != null && pr != null ? cr - pr : null },
    { metric: 'follower_growth', current: cg, previous: pg, change: cg != null && pg ? (cg - pg) / Math.abs(pg) : null },
  ];
}

/** One-line read of what moved, written for a busy reader. */
export function takeaway(h: Headline[]): string {
  const i = h.find((x) => x.metric === 'impressions')?.change;
  const e = h.find((x) => x.metric === 'engagements')?.change;
  if (i == null || e == null) return '';
  if (i >= 0 && e >= 0) return e > i + 0.05 ? 'Reach grew and response grew faster.' : 'Reach and response both grew.';
  if (i >= 0) return 'More people saw the content and fewer acted on it.';
  if (e >= 0) return 'A smaller audience, more of them acting.';
  return e < i - 0.05 ? 'Reach dipped and response dipped harder.' : 'Reach and response both dipped.';
}
