// Pure helpers for the competitor page: brand names, viral scoring and the brand scoreboard.
import type { CompetitorAccountDay, CompetitorPost } from './types';

export interface BrandInfo { brand: string; us?: boolean; colour: string }

/** Instagram handle → display brand. Unknown handles still show, under their handle. */
export const BRANDS: Record<string, BrandInfo> = {
  wingstopuk: { brand: 'Wingstop UK', us: true, colour: 'var(--opal)' },
  raisingcanes: { brand: "Raising Cane's", colour: '#E2231A' },
  kfcuki: { brand: 'KFC UK&I', colour: '#C8102E' },
  kfcuk: { brand: 'KFC UK', colour: '#C8102E' },
  popeyesuk: { brand: 'Popeyes UK', colour: '#F25F1C' },
  nandosuk: { brand: "Nando's", colour: '#D7262E' },
  slimchickensuk: { brand: 'Slim Chickens UK', colour: '#0E6F3F' },
  daveshotchickenuk: { brand: "Dave's Hot Chicken UK", colour: '#E8432E' },
  daveshotchicken: { brand: "Dave's Hot Chicken", colour: '#E8432E' },
  chickfila: { brand: 'Chick-fil-A', colour: '#DD0031' },
  chickfilauk: { brand: 'Chick-fil-A UK', colour: '#DD0031' },
  mcdonaldsuk: { brand: "McDonald's UK", colour: '#FFC72C' },
  wingstop: { brand: 'Wingstop US', colour: '#7FD3C4' },
  wingstopireland: { brand: 'Wingstop Ireland', us: true, colour: 'var(--citrus)' },
};

export const brandOf = (handle: string): BrandInfo => BRANDS[handle.toLowerCase()] ?? { brand: `@${handle}`, colour: '#9a9a9a' };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Score each post against its own account: multiple of that account's median post, and engagement per 1k followers.
 * Viral = at least 2.5x the account's usual post, with enough posts (4+) for "usual" to mean something
 * and enough absolute engagement (300+) that small accounts don't flag noise.
 */
export function scorePosts<T extends Pick<CompetitorPost, 'handle' | 'engagement'>>(rows: T[], followers: Record<string, number | null>): (T & { multiple: number | null; per_1k: number | null; viral: boolean })[] {
  const byHandle = new Map<string, number[]>();
  rows.forEach((r) => { const a = byHandle.get(r.handle) ?? []; a.push(r.engagement ?? 0); byHandle.set(r.handle, a); });
  const med = new Map([...byHandle].map(([h, xs]) => [h, { m: median(xs), n: xs.length }]));
  return rows.map((r) => {
    const s = med.get(r.handle)!;
    const e = r.engagement ?? 0;
    const multiple = s.m > 0 ? e / s.m : null;
    const f = followers[r.handle];
    const per_1k = f ? (e / f) * 1000 : null;
    return { ...r, multiple, per_1k, viral: s.n >= 4 && multiple != null && multiple >= 2.5 && e >= 300 };
  });
}

export interface BrandScore {
  handle: string; brand: string; us: boolean; colour: string;
  followers: number | null; followersChange7: number | null;
  postsThisWeek: number; postsLastWeek: number;
  avgEngagement: number | null; medianPer1k: number | null;
  viral30: number; top: CompetitorPost | null;
}

const shift = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** One row per handle: audience, output this week vs last, typical engagement, viral count, best post (30 days). */
export function scoreboard(posts: CompetitorPost[], days: CompetitorAccountDay[], today: string): BrandScore[] {
  const handles = [...new Set([...posts.map((p) => p.handle), ...days.map((d) => d.handle)])];
  const d7 = shift(today, -7), d14 = shift(today, -14), d30 = shift(today, -30);
  return handles.map((h) => {
    const info = brandOf(h);
    const mine = posts.filter((p) => p.handle === h);
    const snaps = days.filter((d) => d.handle === h && d.followers != null).sort((a, b) => a.date.localeCompare(b.date));
    const latest = snaps.at(-1) ?? null;
    const weekAgo = latest ? [...snaps].reverse().find((s) => s.date <= shift(latest.date, -7)) : undefined;
    const last30 = mine.filter((p) => (p.posted ?? '') >= d30);
    const top = [...last30].sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))[0] ?? null;
    const per = last30.map((p) => p.per_1k).filter((v): v is number => v != null);
    return {
      handle: h, brand: info.brand, us: !!info.us, colour: info.colour,
      followers: latest?.followers ?? null,
      followersChange7: latest && weekAgo ? latest.followers! - weekAgo.followers! : null,
      postsThisWeek: mine.filter((p) => (p.posted ?? '') > d7).length,
      postsLastWeek: mine.filter((p) => (p.posted ?? '') > d14 && (p.posted ?? '') <= d7).length,
      avgEngagement: last30.length ? last30.reduce((s, p) => s + (p.engagement ?? 0), 0) / last30.length : null,
      medianPer1k: per.length ? median(per) : null,
      viral30: last30.filter((p) => p.viral).length,
      top,
    };
  }).sort((a, b) => Number(b.us) - Number(a.us) || (b.followers ?? 0) - (a.followers ?? 0));
}
