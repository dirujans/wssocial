// Paid media: who ran it, what it bought, and how it sits against organic. Pure functions only (tested).
//
// What each platform lets us split, as of Oct 2026:
// - Instagram post views/likes from the API are organic only (Meta docs: ad interactions are not counted).
// - Instagram account-level daily views appear to include ad views; we verify this against our own data
//   (see paidShareCheck) before subtracting anything.
// - TikTok post plays include Spark Ad plays (the boosted post's public count rises), so organic = total minus Spark plays.
// - TikTok gives paid follows per ad; Meta does not give Instagram follows from ads.

export type Agency = 'Translate Culture' | 'MSQ';
export const AGENCY_LABEL: Record<Agency, string> = { 'Translate Culture': 'Translate Culture (Mas)', MSQ: 'SMARTS MSQ' };
export const META_ACCOUNTS: Record<string, Agency> = { '3120245488194717': 'Translate Culture', '1339656694773714': 'MSQ' };
export const TIKTOK_ACCOUNTS: Record<string, Agency> = { '7031642344902426625': 'Translate Culture' };

/** Campaign prefix wins (agencies name their own work), then the account owner. */
export function agencyOf(platform: 'Meta' | 'TikTok', accountId: string, campaign: string | null | undefined): Agency {
  const c = String(campaign ?? '').trim();
  if (/^MSQ[_\s|-]/i.test(c)) return 'MSQ';
  if (/^TC\s*\|/i.test(c)) return 'Translate Culture';
  return (platform === 'Meta' ? META_ACCOUNTS[accountId] : TIKTOK_ACCOUNTS[accountId]) ?? 'Translate Culture';
}

export interface AdDay {
  day: string; platform: 'Meta' | 'TikTok'; placement: string; ad_id: string;
  account_id: string | null; account_name: string | null; agency: Agency; campaign_id: string | null; campaign: string | null; objective: string | null; ad_name: string | null;
  post_key: string | null; post_link: string | null; spark: boolean | null;
  spend: number; impressions: number; reach: number | null; clicks: number | null; link_clicks: number | null;
  video_views: number | null; thruplays: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null;
  follows: number | null; profile_visits: number | null; organic_views: number | null;
}

type Row = Record<string, unknown>;
const n = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const s = (v: unknown): string => (v == null ? '' : String(v));
const normLink = (u: unknown) => s(u).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

export function mapMetaAds(rows: Row[]): AdDay[] {
  return rows.filter((r) => r.date && r.ad_id && ((n(r.spend) ?? 0) > 0 || (n(r.impressions) ?? 0) > 0)).map((r) => {
    const account = s(r.account_id);
    return {
      day: s(r.date), platform: 'Meta', placement: s(r.publisher_platform) || 'all', ad_id: s(r.ad_id),
      account_id: account || null, account_name: s(r.account_name) || null, agency: agencyOf('Meta', account, s(r.campaign)),
      campaign_id: s(r.campaign_id) || null, campaign: s(r.campaign) || null, objective: s(r.campaign_objective) || null, ad_name: s(r.ad_name) || null,
      post_key: r.instagram_permalink_url ? normLink(r.instagram_permalink_url) : null, post_link: s(r.instagram_permalink_url) || null, spark: null,
      spend: n(r.spend) ?? 0, impressions: n(r.impressions) ?? 0, reach: n(r.reach), clicks: n(r.clicks), link_clicks: n(r.actions_link_click),
      video_views: n(r.actions_video_view), thruplays: n(r.video_thruplay_watched_actions_video_view),
      likes: n(r.actions_post_reaction), comments: n(r.actions_comment), shares: n(r.actions_post), saves: n(r.actions_onsite_conversion_post_save),
      follows: null, profile_visits: null, organic_views: null,
    };
  });
}

export function mapTikTokAds(rows: Row[]): AdDay[] {
  return rows.filter((r) => r.date && r.ad_id && ((n(r.spend) ?? 0) > 0 || (n(r.impressions) ?? 0) > 0)).map((r) => {
    const account = s(r.account_id);
    const spark = !!r.item_id && s(r.identity_type) !== 'CUSTOMIZED_USER';
    return {
      day: s(r.date), platform: 'TikTok', placement: 'tiktok', ad_id: s(r.ad_id),
      account_id: account || null, account_name: s(r.account_name) || null, agency: agencyOf('TikTok', account, s(r.campaign_name)),
      campaign_id: s(r.campaign_id) || null, campaign: s(r.campaign_name) || null, objective: s(r.objective_type) || null, ad_name: s(r.ad_name) || null,
      post_key: spark ? s(r.item_id) : null, post_link: spark ? `https://www.tiktok.com/@wingstopuk/video/${s(r.item_id)}` : null, spark,
      spend: n(r.spend) ?? 0, impressions: n(r.impressions) ?? 0, reach: n(r.reach), clicks: n(r.clicks), link_clicks: n(r.clicks),
      video_views: n(r.total_play), thruplays: n(r.focused_view_6s),
      likes: n(r.likes), comments: n(r.comments), shares: n(r.shares), saves: null,
      follows: n(r.follows), profile_visits: n(r.profile_visits), organic_views: spark ? n(r.organic_video_views) : null,
    };
  });
}

/* ---------- Roll-ups ---------- */

export interface Totals { spend: number; impressions: number; views: number; thruplays: number; clicks: number; engagements: number; follows: number; ads: number }
export function totals(rows: AdDay[]): Totals {
  const t: Totals = { spend: 0, impressions: 0, views: 0, thruplays: 0, clicks: 0, engagements: 0, follows: 0, ads: 0 };
  const ads = new Set<string>();
  for (const r of rows) {
    t.spend += r.spend; t.impressions += r.impressions; t.views += r.video_views ?? 0; t.thruplays += r.thruplays ?? 0;
    t.clicks += r.link_clicks ?? 0; t.engagements += (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0); t.follows += r.follows ?? 0;
    ads.add(`${r.platform}:${r.ad_id}`);
  }
  t.ads = ads.size;
  return t;
}
/** Cost per thousand of something; null when there is nothing to divide by. */
export const per1k = (spend: number, x: number) => (x > 0 ? (spend / x) * 1000 : null);
export const per = (spend: number, x: number) => (x > 0 ? spend / x : null);

export interface Efficiency { agency: Agency; platform: string; t: Totals; cpm: number | null; costPer1kViews: number | null; costPerThruplay: number | null; costPerClick: number | null; engagementsPerPound: number | null; costPerFollow: number | null }
export function efficiency(rows: AdDay[]): Efficiency[] {
  const keys = [...new Set(rows.map((r) => `${r.agency}|${r.platform}`))];
  return keys.map((k) => {
    const [agency, platform] = k.split('|') as [Agency, string];
    const t = totals(rows.filter((r) => r.agency === agency && r.platform === platform));
    return {
      agency, platform, t, cpm: per1k(t.spend, t.impressions), costPer1kViews: per1k(t.spend, t.views), costPerThruplay: per(t.spend, t.thruplays),
      costPerClick: per(t.spend, t.clicks), engagementsPerPound: t.spend ? t.engagements / t.spend : null, costPerFollow: per(t.spend, t.follows),
    };
  }).sort((a, b) => b.t.spend - a.t.spend);
}

export interface CampaignRow { key: string; platform: string; agency: Agency; campaign: string; objective: string | null; first: string; last: string; t: Totals; cpm: number | null; costPer1kViews: number | null }
export function campaigns(rows: AdDay[]): CampaignRow[] {
  const m = new Map<string, AdDay[]>();
  for (const r of rows) { const k = `${r.platform}|${r.campaign_id ?? r.campaign}`; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return [...m.entries()].map(([key, rs]) => {
    const t = totals(rs);
    const days = rs.map((r) => r.day).sort();
    return { key, platform: rs[0].platform, agency: rs[0].agency, campaign: rs[0].campaign ?? '(unnamed)', objective: rs[0].objective, first: days[0], last: days[days.length - 1], t, cpm: per1k(t.spend, t.impressions), costPer1kViews: per1k(t.spend, t.views) };
  }).sort((a, b) => b.t.spend - a.t.spend);
}

/** Paid per platform per day, Instagram placement only for Meta (Facebook placements never touch Instagram numbers). */
export function paidByDay(rows: AdDay[]): Map<string, { igImpressions: number; igSpend: number; ttSparkPlays: number; ttPlays: number; ttFollows: number; ttSpend: number; spend: number }> {
  const out = new Map<string, { igImpressions: number; igSpend: number; ttSparkPlays: number; ttPlays: number; ttFollows: number; ttSpend: number; spend: number }>();
  for (const r of rows) {
    const d = out.get(r.day) ?? { igImpressions: 0, igSpend: 0, ttSparkPlays: 0, ttPlays: 0, ttFollows: 0, ttSpend: 0, spend: 0 };
    d.spend += r.spend;
    if (r.platform === 'Meta' && r.placement === 'instagram') { d.igImpressions += r.impressions; d.igSpend += r.spend; }
    if (r.platform === 'TikTok') { d.ttPlays += r.video_views ?? 0; if (r.spark) d.ttSparkPlays += r.video_views ?? 0; d.ttFollows += r.follows ?? 0; d.ttSpend += r.spend; }
    out.set(r.day, d);
  }
  return out;
}

/* ---------- Boosted posts ---------- */

export interface PostLike { comment_key: string; platform: string; posted: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; caption: string; permalink: string | null; thumb_url: string | null; kind: string }
export interface Boost {
  post: PostLike; agency: Agency[]; spend: number; paidViews: number; paidImpressions: number; paidEngagements: number; firstDay: string; lastDay: string;
  /** Organic views of this post: Instagram from the post itself (organic only); TikTok total minus Spark plays, or TikTok's own organic figure. */
  organicViews: number | null;
  /** Organic views against the median of unboosted posts of the same platform posted within 30 days either side. */
  organicVsTypical: number | null;
  lift: number | null; costPer1kPaidViews: number | null;
}

const median = (xs: number[]) => { const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

/** Ads that ran on one of our own posts (boosts and Spark Ads), with what paid added and how the post did organically. */
export function boosts(rows: AdDay[], posts: PostLike[]): Boost[] {
  const byKey = new Map(posts.map((p) => [p.comment_key, p]));
  const groups = new Map<string, AdDay[]>();
  for (const r of rows) if (r.post_key && byKey.has(r.post_key)) (groups.get(r.post_key) ?? groups.set(r.post_key, []).get(r.post_key)!).push(r);
  const boostedKeys = new Set(groups.keys());
  return [...groups.entries()].map(([key, rs]) => {
    const post = byKey.get(key)!;
    const t = totals(rs);
    const days = rs.map((r) => r.day).sort();
    const tiktok = post.platform === 'TikTok';
    const ttOrganic = rs.map((r) => r.organic_views).filter((x): x is number => x != null);
    const organicViews = tiktok ? (ttOrganic.length ? Math.max(...ttOrganic) : post.views != null ? Math.max(0, post.views - t.views) : null) : post.views;
    const peers = posts.filter((p) => p.platform === post.platform && !boostedKeys.has(p.comment_key) && dayDiff(p.posted, post.posted) <= 30 && (p.views ?? 0) > 0).map((p) => p.views as number);
    const typical = peers.length >= 4 ? median(peers) : null;
    const paidViews = tiktok ? t.views : t.impressions;
    return {
      post, agency: [...new Set(rs.map((r) => r.agency))], spend: t.spend, paidViews, paidImpressions: t.impressions, paidEngagements: t.engagements,
      firstDay: days[0], lastDay: days[days.length - 1], organicViews,
      organicVsTypical: organicViews != null && typical ? organicViews / typical : null,
      lift: organicViews ? (organicViews + paidViews) / organicViews : null,
      costPer1kPaidViews: per1k(t.spend, paidViews),
    };
  }).sort((a, b) => b.spend - a.spend);
}

/* ---------- Organic / paid / combined ---------- */

export type Split = 'combined' | 'organic' | 'paid';

/**
 * How much of Instagram's account-level daily views comes from ads, learnt from our own history:
 * views = organic baseline + k x Instagram ad impressions. If the fit is strong, k is how many account views each
 * ad impression adds (close to 1 means ads are fully inside the account figure). If the fit is weak we don't subtract.
 * Checked 20 Oct 2026: account views tracked Instagram ad impressions almost one for one (e.g. 1 to 4 Oct).
 */
export function igPaidModel(accountViews: Map<string, number>, paid: ReturnType<typeof paidByDay>) {
  const days = [...accountViews.keys()];
  const xs = days.map((d) => paid.get(d)?.igImpressions ?? 0), ys = days.map((d) => accountViews.get(d) ?? 0);
  const withAds = xs.filter((x) => x > 1000).length;
  if (days.length < 21 || withAds < 10) return { days: days.length, withAds, k: null as number | null, baseline: null as number | null, correlation: null as number | null, includesAds: false };
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxy = xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0), sxx = xs.reduce((t, x) => t + (x - mx) ** 2, 0), syy = ys.reduce((t, y) => t + (y - my) ** 2, 0);
  const k = sxx ? sxy / sxx : null;
  const correlation = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  const includesAds = k != null && correlation != null && correlation >= 0.6 && k >= 0.4 && k <= 1.6;
  return { days: days.length, withAds, k: includesAds ? Math.min(1, k!) : null, baseline: k != null ? my - k * mx : null, correlation, includesAds };
}

/**
 * Daily views per platform split into organic and paid.
 * Instagram: when the model says account views include ads, paid = k x ad impressions, taken out of the account figure;
 * otherwise account views are organic and ad impressions are added on top.
 * TikTok: account plays include Spark plays; non-Spark ads run outside the account and are added on top.
 */
export function splitViews(day: string, platform: 'Instagram' | 'TikTok', accountViews: number, paid: ReturnType<typeof paidByDay>, igK: number | null) {
  const p = paid.get(day);
  if (platform === 'Instagram') {
    const ads = p?.igImpressions ?? 0;
    if (igK != null) { const inside = Math.min(accountViews, Math.round(ads * igK)); return { organic: accountViews - inside, paid: inside, combined: accountViews }; }
    return { organic: accountViews, paid: ads, combined: accountViews + ads };
  }
  const spark = p?.ttSparkPlays ?? 0, other = (p?.ttPlays ?? 0) - spark;
  const inside = Math.min(accountViews, spark);
  return { organic: accountViews - inside, paid: inside + other, combined: accountViews + other };
}

/* ---------- Spikes ---------- */

export interface Spike { day: string; platform: 'Instagram' | 'TikTok'; combined: number; typical: number; multiple: number; paidShare: number; spend: number; verdict: 'Paid' | 'Organic' | 'Both' }
/** Days where combined views ran at 1.8x or more the trailing 28-day median, and how much of that day was paid. */
export function spikes(series: { day: string; platform: 'Instagram' | 'TikTok'; organic: number; paid: number; spend: number }[]): Spike[] {
  const out: Spike[] = [];
  for (const plat of ['Instagram', 'TikTok'] as const) {
    const s2 = series.filter((x) => x.platform === plat).sort((a, b) => a.day.localeCompare(b.day));
    s2.forEach((x, i) => {
      if (i < 14) return;
      const typical = median(s2.slice(Math.max(0, i - 28), i).map((y) => y.organic + y.paid));
      const combined = x.organic + x.paid;
      if (!typical || combined < typical * 1.8) return;
      const paidShare = combined ? x.paid / combined : 0;
      const organicTypical = median(s2.slice(Math.max(0, i - 28), i).map((y) => y.organic)) ?? 0;
      const organicSpiked = organicTypical > 0 && x.organic >= organicTypical * 1.8;
      out.push({ day: x.day, platform: plat, combined, typical, multiple: combined / typical, paidShare, spend: x.spend, verdict: paidShare >= 0.6 && !organicSpiked ? 'Paid' : organicSpiked && paidShare < 0.4 ? 'Organic' : 'Both' });
    });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}

/* ---------- Compact transport for the browser ----------
 * ~10k ad-day rows as objects is ~7 MB of page payload. Ad details are sent once per ad, rows as number arrays,
 * and Meta placements other than Instagram are merged into one 'other' row (only the Instagram placement matters downstream). */
const NUM_KEYS = ['spend', 'impressions', 'reach', 'clicks', 'link_clicks', 'video_views', 'thruplays', 'likes', 'comments', 'shares', 'saves', 'follows', 'profile_visits', 'organic_views'] as const;
const META_KEYS = ['platform', 'ad_id', 'account_id', 'account_name', 'agency', 'campaign_id', 'campaign', 'objective', 'ad_name', 'post_key', 'post_link', 'spark'] as const;
type AdMeta = Pick<AdDay, (typeof META_KEYS)[number]>;
export interface PackedAds { ads: AdMeta[]; rows: [string, number, string, ...(number | null)[]][] }

export function packAds(rows: AdDay[]): PackedAds {
  const idx = new Map<string, number>(), ads: AdMeta[] = [];
  const merged = new Map<string, AdDay>();
  for (const r of rows) {
    if (!r.spend && !r.impressions) continue;
    const placement = r.platform === 'Meta' && r.placement !== 'instagram' ? 'other' : r.placement;
    const k = `${r.day}|${r.platform}|${r.ad_id}|${placement}`;
    const m = merged.get(k);
    if (!m) { merged.set(k, { ...r, placement }); continue; }
    for (const f of NUM_KEYS) { const a = m[f], b = r[f]; (m as unknown as Record<string, number | null>)[f] = a == null && b == null ? null : f === 'organic_views' ? Math.max(a ?? 0, b ?? 0) : (a ?? 0) + (b ?? 0); }
  }
  const out: PackedAds['rows'] = [];
  for (const r of merged.values()) {
    const ak = `${r.platform}|${r.ad_id}`;
    let i = idx.get(ak);
    if (i === undefined) { i = ads.length; idx.set(ak, i); ads.push(Object.fromEntries(META_KEYS.map((k) => [k, r[k]])) as AdMeta); }
    const nums = NUM_KEYS.map((f) => { const v = r[f]; return v == null ? null : f === 'spend' ? Math.round(v * 100) / 100 : v; });
    out.push([r.day, i, r.placement, ...nums]);
  }
  return { ads, rows: out };
}

export function unpackAds(p: PackedAds): AdDay[] {
  return p.rows.map(([day, i, placement, ...nums]) => {
    const r = { ...p.ads[i], day, placement } as AdDay;
    NUM_KEYS.forEach((f, j) => { (r as unknown as Record<string, number | null>)[f] = f === 'spend' || f === 'impressions' ? Number(nums[j] ?? 0) : (nums[j] as number | null); });
    return r;
  });
}
