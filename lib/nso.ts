// NSO helpers: creator fit scoring (ported from the original NSO Intelligence dashboard), Modash CSV import, and city lift.
import type { CityDay, NsoCreator } from './types';

type P = 'tiktok' | 'instagram' | 'youtube' | string;

function scoreReach(f: number, p: P) {
  if (p === 'tiktok') { if (f < 10000) return 35; if (f < 50000) return 65; if (f < 150000) return 85; if (f < 500000) return 95; if (f < 1000000) return 80; return 55; }
  if (f < 5000) return 25; if (f < 20000) return 55; if (f < 80000) return 75; if (f < 200000) return 90; if (f < 500000) return 85; return 60;
}
function scoreEng(r: number, p: P) {
  const b = ({ tiktok: [0.03, 0.05, 0.07, 0.10], instagram: [0.01, 0.02, 0.04, 0.06], youtube: [0.02, 0.03, 0.05, 0.08] } as Record<string, number[]>)[p] ?? [0.01, 0.02, 0.04, 0.06];
  if (r < b[0]) return 10; if (r < b[1]) return 40; if (r < b[2]) return 65; if (r < b[3]) return 85; return 100;
}
function scoreAud(a: number, b: number, l: number, f: number) {
  const age = Math.min((a + b) * 1.4 * 100, 100), loc = Math.min(l * 5 * 100, 100), gen = Math.max((1 - Math.abs(f - 0.5) * 1.5) * 100, 0);
  return Math.round(age * 0.4 + loc * 0.45 + gen * 0.15);
}
function scoreContent(cats: string[], text: string) {
  let s = 50; const c = cats.map((x) => x.toLowerCase()); const t = text.toLowerCase();
  if (c.some((x) => ['food', 'foodie', 'eating', 'restaurant', 'street food', 'reviews', 'restaurant reviews'].includes(x))) s += 20;
  if (c.some((x) => ['culture', 'lifestyle', 'challenges', 'nightlife', 'music'].includes(x))) s += 10;
  if (c.some((x) => ['spicy', 'heat', 'challenge', 'hot wings'].includes(x))) s += 15;
  s += Math.min(['wings', 'chicken', 'food', 'eat', 'flavour', 'spicy', 'hot', 'ranking', 'tier list', 'halal', 'review'].filter((k) => t.includes(k)).length * 3, 15);
  return Math.min(s, 100);
}
const W = { reach: 0.15, engagement: 0.25, audience: 0.25, content: 0.2, safety: 0.1, platform: 0.05 };

export interface Fit { total: number; tier: 'S' | 'A' | 'B' | 'C' | 'D'; recommendation: 'definitely' | 'shortlist' | 'consider' | 'pass'; dims: Record<string, number | null>; flags: string[]; partial: boolean }

/**
 * Same weights as the original dashboard. Unlike the original, missing data is not filled with flattering defaults:
 * a dimension with no data is left out and the remaining weights are rescaled, and the score is marked partial.
 */
export function computeFit(c: Pick<NsoCreator, 'platform' | 'followers' | 'engagement_rate' | 'age1824' | 'age2534' | 'female_pct' | 'location_pct' | 'fake_score' | 'competitor_history' | 'categories' | 'why'>): Fit {
  const dims: Record<string, number | null> = {
    reach: c.followers != null ? scoreReach(c.followers, c.platform) : null,
    engagement: c.engagement_rate != null ? scoreEng(c.engagement_rate, c.platform) : null,
    audience: c.age1824 != null || c.age2534 != null ? scoreAud(c.age1824 ?? 0, c.age2534 ?? 0, c.location_pct ?? 0.15, c.female_pct ?? 0.5) : null,
    content: scoreContent(c.categories ?? [], c.why ?? ''),
    safety: null, platform: ({ tiktok: 100, instagram: 80, youtube: 60 } as Record<string, number>)[c.platform] ?? 70,
  };
  const flags: string[] = [];
  if (c.fake_score != null || c.competitor_history) {
    let s = 100;
    if ((c.fake_score ?? 0) > 0.3) { s -= 40; flags.push(`High fake followers: ${Math.round((c.fake_score ?? 0) * 100)}%`); }
    else if ((c.fake_score ?? 0) > 0.15) { s -= 15; flags.push(`Moderate fake followers: ${Math.round((c.fake_score ?? 0) * 100)}%`); }
    if (c.competitor_history) { s -= 25; flags.push('Has worked with a competitor'); }
    dims.safety = Math.max(s, 0);
  }
  let wsum = 0, total = 0;
  (Object.keys(W) as (keyof typeof W)[]).forEach((k) => { const v = dims[k]; if (v != null) { total += v * W[k]; wsum += W[k]; } });
  const score = Math.round(wsum ? total / wsum : 0);
  const partial = dims.reach == null || dims.engagement == null || dims.audience == null;
  return {
    total: score, dims, flags, partial,
    tier: score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D',
    recommendation: score >= 88 ? 'definitely' : score >= 72 ? 'shortlist' : score >= 55 ? 'consider' : 'pass',
  };
}

/** Split one CSV line, respecting quotes ("182,000" stays one field). */
function splitLine(line: string): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export type CreatorInput = Omit<NsoCreator, 'id' | 'opening_id' | 'shortlisted' | 'notes'>;

/** Modash (or similar) export → creators. Matches columns by name, so column order doesn't matter. */
export function parseCreatorCsv(text: string): CreatorInput[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const col = (row: string[], ...names: string[]) => { for (const n of names) { const i = headers.findIndex((h) => h.includes(n)); if (i >= 0 && row[i]) return row[i]; } return ''; };
  const pct = (v: string) => { if (!v) return null; const n = parseFloat(v.replace('%', '')); return Number.isFinite(n) ? (v.includes('%') || n > 1 ? n / 100 : n) : null; };
  const num = (v: string) => { if (!v) return null; const m = v.replace(/,/g, '').match(/([\d.]+)\s*([kKmM])?/); if (!m) return null; return Math.round(parseFloat(m[1]) * (m[2] ? (/[mM]/.test(m[2]) ? 1e6 : 1e3) : 1)); };
  return lines.slice(1).map((line) => {
    const r = splitLine(line);
    const followers = num(col(r, 'followers'));
    const rawHandle = col(r, 'username', 'handle');
    if (!rawHandle) return null;
    const p = col(r, 'platform').toLowerCase();
    const cred = pct(col(r, 'credibility'));
    return {
      handle: rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`,
      name: col(r, 'full name', 'name') || null,
      platform: p.includes('tiktok') ? 'tiktok' : p.includes('youtube') ? 'youtube' : 'instagram',
      followers, followers_note: followers != null ? 'CSV import' : null,
      engagement_rate: pct(col(r, 'engagement')),
      age1824: pct(col(r, '18-24')), age2534: pct(col(r, '25-34')),
      female_pct: pct(col(r, 'female')), location_pct: pct(col(r, 'location', 'city %', 'city share')),
      fake_score: cred != null ? 1 - cred : null,
      categories: col(r, 'categor', 'interests').split(/[;|]/).map((c) => c.trim().toLowerCase()).filter(Boolean),
      email: col(r, 'email') || null, competitor_history: /yes|true/i.test(col(r, 'competitor')),
      why: null, source: 'csv', source_url: null,
    } as CreatorInput;
  }).filter((x): x is CreatorInput => x != null);
}

/** Instagram followers in a city over time, with the change from the opening date (or first snapshot) to now. */
export function cityLift(rows: CityDay[], cityMatch: string | null, opensOn: string | null) {
  if (!cityMatch) return { series: [], first: null, latest: null, atOpening: null, change: null, sinceLabel: '' };
  const m = cityMatch.toLowerCase();
  const byDate = new Map<string, number>();
  rows.filter((r) => r.platform !== 'TikTok' && r.city.toLowerCase().split(',')[0].trim() === m)
    .forEach((r) => byDate.set(r.date, (byDate.get(r.date) ?? 0) + (r.followers ?? 0)));
  const series = [...byDate].sort((a, b) => a[0].localeCompare(b[0])).map(([date, followers]) => ({ date, followers }));
  const latest = series.at(-1) ?? null, first = series[0] ?? null;
  const atOpening = opensOn ? [...series].reverse().find((s) => s.date <= opensOn) ?? null : null;
  const base = atOpening ?? first;
  return { series, first, latest, atOpening, change: base && latest && base !== latest ? latest.followers - base.followers : null, sinceLabel: atOpening ? 'since opening' : 'since tracking began' };
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
