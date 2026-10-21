// Windsor.ai Connectors API. Docs: https://windsor.ai/api-information/
// The key only travels as a query parameter (Windsor does not accept header auth),
// so never log full URLs: HttpError masks it.

import { fetchWithRetry } from './http';
import { mapMetaAds, mapTikTokAds, META_ACCOUNTS, TIKTOK_ACCOUNTS, type AdDay } from './paid';
import { themeOf } from './themes';
import { brandOf, scorePosts } from './competitors';
import { NETWORK_TO_CHANNEL, type AccountDay, type Comment, type AudienceDemo, type CompetitorAccountDay, type CompetitorPost, type Media, type Post, type ProfileDay } from './types';

const BASE = 'https://connectors.windsor.ai';

export const ACCOUNTS = {
  sprout: process.env.WINDSOR_SPROUT_ACCOUNT_ID ?? '2454071',
  instagramUK: process.env.WINDSOR_IG_UK_ID ?? '17841403911240491',
  instagramIE: process.env.WINDSOR_IG_IE_ID ?? '17841477228197665',
};

type Row = Record<string, unknown>;

export async function windsor(connector: string, fields: string[], opts: { datePreset?: string; dateFrom?: string; dateTo?: string; accounts?: string[] }): Promise<Row[]> {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) throw new Error('WINDSOR_API_KEY is not set');
  const qs = new URLSearchParams({ api_key: key, fields: fields.join(',') });
  if (opts.dateFrom && opts.dateTo) { qs.set('date_from', opts.dateFrom); qs.set('date_to', opts.dateTo); }
  else if (opts.datePreset) qs.set('date_preset', opts.datePreset);
  if (opts.accounts?.length) qs.set('select_accounts', opts.accounts.join(','));
  // Windsor caches each exact URL for 6 hours, so an otherwise identical call returns stale rows
  // (launch-day comments were missing). A per-run marker makes every sync a new URL.
  qs.set('_run', String(Math.floor(Date.now() / 60000)));
  const res = await fetchWithRetry(`${BASE}/${connector}?${qs}`);
  const json = (await res.json()) as { data?: Row[]; error?: string };
  if (!Array.isArray(json.data)) throw new Error(`Windsor ${connector}: ${json.error ?? 'no data in response'}`);
  return json.data;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
export const normLink = (u: unknown) => str(u).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

function formatOf(t: unknown): Post['format'] {
  const s = str(t);
  if (/STORY/.test(s)) return 'Story';
  if (/REEL/.test(s)) return 'Reel';
  if (/VIDEO/.test(s)) return 'Video';
  if (/_AD$/.test(s)) return 'Ad';
  return 'Post';
}

export async function fetchProfileDays(datePreset = 'last_120d'): Promise<ProfileDay[]> {
  const rows = await windsor(
    'sproutsocial',
    ['date', 'profile_network_type', 'profile_impressions', 'profile_engagements', 'profile_followers', 'profile_posts_sent'],
    { datePreset, accounts: [ACCOUNTS.sprout] },
  );
  return rows
    .filter((r) => r.date && NETWORK_TO_CHANNEL[str(r.profile_network_type)])
    .map((r) => ({
      date: str(r.date),
      channel: NETWORK_TO_CHANNEL[str(r.profile_network_type)],
      impressions: num(r.profile_impressions),
      engagements: num(r.profile_engagements),
      followers: num(r.profile_followers),
      posts_sent: num(r.profile_posts_sent),
    }));
}

// Do not add post_sentiment_score or post_comments_positive/negative/neutral:
// the current Sprout plan refuses them and the whole request fails.
export async function fetchPosts(datePreset = 'last_60dT'): Promise<Post[]> {
  const rows = await windsor(
    'sproutsocial',
    ['post_guid', 'post_created_time', 'post_network', 'post_type', 'post_text', 'post_permalink', 'post_impressions', 'post_reach', 'post_video_views', 'post_likes', 'post_comments', 'post_shares', 'post_saves'],
    { datePreset, accounts: [ACCOUNTS.sprout] },
  );
  const out = new Map<string, Post>();
  for (const r of rows) {
    const guid = str(r.post_guid);
    const channel = NETWORK_TO_CHANNEL[str(r.post_network)];
    if (!guid || !channel) continue;
    const imp = num(r.post_impressions);
    const vv = num(r.post_video_views);
    const likes = num(r.post_likes) ?? 0, comments = num(r.post_comments), shares = num(r.post_shares) ?? 0, saves = num(r.post_saves) ?? 0;
    const engagements = likes + (comments ?? 0) + shares + saves;
    out.set(guid, {
      post_guid: guid,
      posted: str(r.post_created_time).slice(0, 10),
      posted_at: str(r.post_created_time),
      channel,
      format: formatOf(r.post_type),
      text: str(r.post_text),
      link: str(r.post_permalink),
      impressions: imp,
      reach: num(r.post_reach),
      views: vv != null && vv > 0 ? vv : imp,
      likes, comments, shares, saves, engagements,
      engagement_rate: imp ? engagements / imp : null,
      comment_key: guid.startsWith('tktvid:') ? guid.slice(7) : normLink(r.post_permalink),
    });
  }
  return [...out.values()];
}

export async function fetchComments(datePreset = 'last_14dT'): Promise<Comment[]> {
  const igFields = ['account_id', 'date', 'media_permalink', 'comment_id', 'comment_text', 'comment_like_count', 'comment_reply_count', 'comment_timestamp'];
  const igAccounts = [ACCOUNTS.instagramUK, ACCOUNTS.instagramIE];
  // The 14-day Instagram call stopped returning the newest days (19 Oct: launch reel had 150 comments, we got none),
  // so a short window runs alongside it and the two are merged by comment id. A failed short call never blocks the long one.
  const [igLong, igRecent, tt] = await Promise.all([
    windsor('instagram', igFields, { datePreset, accounts: igAccounts }),
    windsor('instagram', igFields, { datePreset: 'last_3dT', accounts: igAccounts }).catch(() => [] as Row[]),
    windsor('tiktok_organic', ['date', 'comment_video_id', 'comment_id', 'comment_text', 'comment_username', 'comment_likes'], { datePreset }),
  ]);
  const ig = [...new Map([...igLong, ...igRecent].map((r) => [str(r.comment_id), r])).values()];
  const igRows: Comment[] = ig
    .filter((c) => c.comment_id && c.comment_text)
    .map((c) => ({
      comment_id: `ig_${str(c.comment_id)}`,
      platform: str(c.account_id) === ACCOUNTS.instagramIE ? 'Instagram IE' : 'Instagram',
      text: str(c.comment_text),
      likes: num(c.comment_like_count) ?? 0,
      replies: num(c.comment_reply_count),
      author: null, // Meta hides usernames
      commented_at: c.comment_timestamp ? str(c.comment_timestamp).replace(/\+0000$/, 'Z') : null,
      post_date: str(c.date),
      post_key: normLink(c.media_permalink),
      post_link: c.media_permalink ? str(c.media_permalink) : null,
      theme: themeOf(str(c.comment_text)),
    }));
  const ttRows: Comment[] = tt
    .filter((c) => c.comment_id && c.comment_text)
    .map((c) => ({
      comment_id: `tt_${str(c.comment_id)}`,
      platform: 'TikTok',
      text: str(c.comment_text),
      likes: num(c.comment_likes) ?? 0,
      replies: null,
      author: c.comment_username ? str(c.comment_username) : null,
      commented_at: null, // TikTok gives no comment time
      post_date: str(c.date),
      post_key: str(c.comment_video_id),
      post_link: null,
      theme: themeOf(str(c.comment_text)),
    }));
  return [...igRows, ...ttRows];
}

const igPlatform = (accountId: unknown): Media['platform'] => (str(accountId) === ACCOUNTS.instagramIE ? 'Instagram IE' : 'Instagram');

function igKind(type: unknown, product: unknown): Media['kind'] {
  const t = str(type), p = str(product);
  if (t === 'REELS' || p === 'REELS') return 'Reel';
  if (t === 'CAROUSEL_ALBUM') return 'Carousel';
  if (t === 'VIDEO') return 'Video';
  return 'Image';
}

/** Instagram feed posts and reels, and TikTok videos, with media and per-post saves, shares, reposts. */
export async function fetchMedia(datePreset = 'last_120dT'): Promise<Media[]> {
  const [ig, tt] = await Promise.all([
    windsor(
      'instagram',
      ['account_id', 'media_id', 'timestamp', 'media_type', 'media_product_type', 'media_permalink', 'media_url', 'media_thumbnail_url', 'media_caption', 'media_views', 'media_reach', 'media_shares', 'media_saved', 'media_reposts', 'media_total_like_count', 'media_total_comments_count'],
      { datePreset, accounts: [ACCOUNTS.instagramUK, ACCOUNTS.instagramIE] },
    ),
    windsor(
      'tiktok_organic',
      ['video_id', 'video_create_datetime', 'video_caption', 'video_thumbnail_url', 'video_embed_url', 'video_share_url', 'video_views_count', 'video_reach', 'video_likes', 'video_comments', 'video_shares', 'video_favorites', 'video_full_watched_rate', 'video_average_time_watched', 'video_new_followers'],
      { datePreset },
    ),
  ]);
  const out = new Map<string, Media>();
  for (const m of ig) {
    if (!m.media_id) continue;
    const kind = igKind(m.media_type, m.media_product_type);
    const isVideo = kind === 'Reel' || kind === 'Video';
    const ts = str(m.timestamp).replace(/\+0000$/, 'Z');
    out.set(`ig_${str(m.media_id)}`, {
      id: `ig_${str(m.media_id)}`, platform: igPlatform(m.account_id), posted_at: ts, posted: ts.slice(0, 10), kind,
      caption: str(m.media_caption), permalink: m.media_permalink ? str(m.media_permalink) : null,
      media_url: m.media_url ? str(m.media_url) : null,
      thumb_url: isVideo ? (m.media_thumbnail_url ? str(m.media_thumbnail_url) : null) : (m.media_url ? str(m.media_url) : null),
      embed_url: null,
      views: num(m.media_views), reach: num(m.media_reach), likes: num(m.media_total_like_count), comments: num(m.media_total_comments_count),
      shares: num(m.media_shares), saves: num(m.media_saved), reposts: num(m.media_reposts),
      full_watch_rate: null, avg_watch_s: null, new_followers: null,
      comment_key: normLink(m.media_permalink),
    });
  }
  for (const v of tt) {
    if (!v.video_id) continue;
    const ts = str(v.video_create_datetime);
    const iso = ts && !/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts + 'Z' : ts;
    out.set(`tt_${str(v.video_id)}`, {
      id: `tt_${str(v.video_id)}`, platform: 'TikTok', posted_at: iso, posted: iso.slice(0, 10),
      kind: /photomode/.test(str(v.video_thumbnail_url)) ? 'Photo' : 'Video',
      caption: str(v.video_caption), permalink: v.video_share_url ? str(v.video_share_url).replace(/\?.*$/, '') : null,
      media_url: null, thumb_url: v.video_thumbnail_url ? str(v.video_thumbnail_url) : null,
      embed_url: v.video_embed_url ? str(v.video_embed_url) : `https://www.tiktok.com/player/v1/${str(v.video_id)}`,
      views: num(v.video_views_count), reach: num(v.video_reach), likes: num(v.video_likes), comments: num(v.video_comments),
      shares: num(v.video_shares), saves: num(v.video_favorites), reposts: null,
      full_watch_rate: num(v.video_full_watched_rate), avg_watch_s: num(v.video_average_time_watched), new_followers: num(v.video_new_followers),
      comment_key: str(v.video_id),
    });
  }
  return [...out.values()];
}

/**
 * Daily account totals: Instagram UK and IE, and TikTok.
 * Platform limits: Instagram follower counts cover the last 30 days only; TikTok account data the last 60 days.
 * Follows are returned as separate rows so a later sync never blanks out follows already stored.
 */
export async function fetchAccountDays(): Promise<{ metrics: Omit<AccountDay, 'follows'>[]; follows: Pick<AccountDay, 'date' | 'platform' | 'follows'>[] }> {
  const igAccounts = [ACCOUNTS.instagramUK, ACCOUNTS.instagramIE];
  const [ig, igFollows, tt] = await Promise.all([
    windsor('instagram', ['account_id', 'date', 'views', 'reach', 'likes', 'comments', 'shares', 'saves', 'reposts', 'total_interactions'], { datePreset: 'last_120d', accounts: igAccounts }),
    windsor('instagram', ['account_id', 'date', 'follower_count'], { datePreset: 'last_30d', accounts: igAccounts }),
    windsor('tiktok_organic', ['date', 'video_views', 'likes', 'comments', 'shares', 'profile_views', 'followers_count'], { datePreset: 'last_60d' }),
  ]);
  const metrics: Omit<AccountDay, 'follows'>[] = [
    ...ig.filter((r) => r.date).map((r) => ({
      date: str(r.date), platform: igPlatform(r.account_id),
      views: num(r.views), reach: num(r.reach), likes: num(r.likes), comments: num(r.comments), shares: num(r.shares),
      saves: num(r.saves), reposts: num(r.reposts), interactions: num(r.total_interactions), profile_views: null,
    })),
    // Zero rows are days TikTok has not filled in yet.
    ...tt.filter((r) => r.date && (num(r.video_views) ?? 0) > 0).map((r) => ({
      date: str(r.date), platform: 'TikTok' as const,
      views: num(r.video_views), reach: null, likes: num(r.likes), comments: num(r.comments), shares: num(r.shares),
      saves: null, reposts: null, interactions: null, profile_views: num(r.profile_views),
    })),
  ];
  // Today's follower count reads 0 until the platform fills it, so skip zeros on the latest two days.
  const recent = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const follows: Pick<AccountDay, 'date' | 'platform' | 'follows'>[] = [
    ...igFollows.filter((r) => r.date && !(str(r.date) >= recent && !num(r.follower_count))).map((r) => ({ date: str(r.date), platform: igPlatform(r.account_id), follows: num(r.follower_count) })),
    ...tt.filter((r) => r.date && (num(r.video_views) ?? 0) > 0).map((r) => ({ date: str(r.date), platform: 'TikTok' as const, follows: num(r.followers_count) })),
  ];
  return { metrics, follows };
}

/**
 * Competitors' public Instagram (Windsor instagram_public, business discovery). Every handle added in Windsor comes back,
 * so new competitors need no code change. Includes @wingstopuk as our own benchmark.
 * Returns posts scored against each account's own median, plus today's follower snapshot per handle.
 */
export async function fetchCompetitorSocial(datePreset = 'last_120d'): Promise<{ posts: CompetitorPost[]; accounts: CompetitorAccountDay[] }> {
  const rows = await windsor(
    'instagram_public',
    ['account_name', 'profile_followers_count', 'profile_media_count', 'media_id', 'media_timestamp', 'media_type', 'media_product_type', 'media_like_count', 'media_comments_count', 'media_permalink', 'media_thumbnail_url', 'media_url', 'media_caption'],
    { datePreset },
  );
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const followers: Record<string, number | null> = {};
  const accounts = new Map<string, CompetitorAccountDay>();
  const posts = new Map<string, Omit<CompetitorPost, 'multiple' | 'per_1k' | 'viral'>>();
  for (const r of rows) {
    const handle = str(r.account_name).toLowerCase();
    if (!handle) continue;
    const brand = brandOf(handle).brand;
    const f = num(r.profile_followers_count);
    if (f != null) followers[handle] = f;
    if (!accounts.has(handle)) accounts.set(handle, { date: today, handle, platform: 'Instagram', brand, followers: f, media_count: num(r.profile_media_count) });
    if (!r.media_id) continue;
    const kind = igKind(r.media_type, r.media_product_type);
    const isVideo = kind === 'Reel' || kind === 'Video';
    const ts = str(r.media_timestamp).replace(/\+0000$/, 'Z');
    const likes = num(r.media_like_count), comments = num(r.media_comments_count);
    posts.set(`igp_${str(r.media_id)}`, {
      id: `igp_${str(r.media_id)}`, handle, brand, platform: 'Instagram', posted_at: ts || null, posted: ts ? ts.slice(0, 10) : null, kind,
      caption: str(r.media_caption), permalink: r.media_permalink ? str(r.media_permalink) : null,
      media_url: r.media_url ? str(r.media_url) : null,
      thumb_url: isVideo ? (r.media_thumbnail_url ? str(r.media_thumbnail_url) : null) : (r.media_url ? str(r.media_url) : null),
      likes, comments, engagement: (likes ?? 0) + (comments ?? 0),
    });
  }
  return { posts: scorePosts([...posts.values()], followers), accounts: [...accounts.values()] };
}

/**
 * Who follows us: Instagram UK and Ireland (lifetime follower demographics, counts) and TikTok (follower shares).
 * Plus current follower totals per platform. One latest snapshot per key; history is not needed for demographics.
 */
export async function fetchAudience(): Promise<AudienceDemo[]> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const out: AudienceDemo[] = [];
  const add = (platform: string, dimension: string, key: unknown, value: unknown, unit: 'count' | 'share') => {
    const k = str(key).trim(); const v = num(value);
    if (k && v != null) out.push({ platform, dimension, key: k, value: v, unit, snapshot_date: today });
  };
  const igName = (id: unknown) => (str(id) === ACCOUNTS.instagramIE ? 'Instagram IE' : 'Instagram');
  const ig = [ACCOUNTS.instagramUK, ACCOUNTS.instagramIE];
  const settled = await Promise.allSettled([
    windsor('instagram', ['account_id', 'audience_gender_age_name', 'audience_gender_age_size'], { datePreset: 'last_7d', accounts: ig }),
    windsor('instagram', ['account_id', 'city', 'audience_city_size'], { datePreset: 'last_7d', accounts: ig }),
    windsor('instagram', ['account_id', 'audience_country_name', 'audience_country_size'], { datePreset: 'last_7d', accounts: ig }),
    windsor('instagram', ['account_id', 'followers_count', 'media_count'], { datePreset: 'last_3d', accounts: ig }),
    windsor('tiktok_organic', ['audience_ages_age', 'audience_ages_percentage'], { datePreset: 'last_7d' }),
    windsor('tiktok_organic', ['audience_genders_gender', 'audience_genders_percentage'], { datePreset: 'last_7d' }),
    windsor('tiktok_organic', ['audience_countries_country', 'audience_countries_percentage'], { datePreset: 'last_7d' }),
    windsor('tiktok_organic', ['audience_cities_city_name', 'audience_cities_percentage'], { datePreset: 'last_7d' }),
    windsor('tiktok_organic', ['date', 'total_followers_count', 'total_likes', 'videos_count'], { datePreset: 'last_7d' }),
  ]);
  const rows = (i: number) => (settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<Row[]>).value : []);
  rows(0).forEach((r) => add(igName(r.account_id), 'gender_age', r.audience_gender_age_name, r.audience_gender_age_size, 'count'));
  rows(1).forEach((r) => add(igName(r.account_id), 'city', r.city, r.audience_city_size, 'count'));
  rows(2).forEach((r) => add(igName(r.account_id), 'country', r.audience_country_name, r.audience_country_size, 'count'));
  rows(3).forEach((r) => { add(igName(r.account_id), 'total', 'followers', r.followers_count, 'count'); add(igName(r.account_id), 'total', 'posts', r.media_count, 'count'); });
  rows(4).forEach((r) => add('TikTok', 'age', r.audience_ages_age, r.audience_ages_percentage, 'share'));
  rows(5).forEach((r) => add('TikTok', 'gender', r.audience_genders_gender, r.audience_genders_percentage, 'share'));
  rows(6).forEach((r) => add('TikTok', 'country', r.audience_countries_country, r.audience_countries_percentage, 'share'));
  rows(7).forEach((r) => add('TikTok', 'city', r.audience_cities_city_name, r.audience_cities_percentage, 'share'));
  // TikTok totals: latest day with a real count (recent days can come back as 0).
  const tt = rows(8).filter((r) => (num(r.total_followers_count) ?? 0) > 0).sort((a, b) => str(b.date).localeCompare(str(a.date)))[0];
  if (tt) { add('TikTok', 'total', 'followers', tt.total_followers_count, 'count'); if (num(tt.total_likes)) add('TikTok', 'total', 'likes', tt.total_likes, 'count'); if (num(tt.videos_count)) add('TikTok', 'total', 'posts', tt.videos_count, 'count'); }
  const failed = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
  if (failed.length === settled.length) throw new Error(String(failed[0].reason?.message ?? failed[0].reason));
  // De-duplicate (same key can repeat across a 7-day window): keep the largest value.
  const m = new Map<string, AudienceDemo>();
  out.forEach((r) => { const k = `${r.platform}|${r.dimension}|${r.key}`; const cur = m.get(k); if (!cur || (r.value ?? 0) > (cur.value ?? 0)) m.set(k, r); });
  return [...m.values()];
}

/* ---------- Paid (Meta and TikTok ad accounts) ---------- */

const META_AD_FIELDS = ['date', 'account_id', 'account_name', 'campaign_id', 'campaign', 'campaign_objective', 'ad_id', 'ad_name', 'publisher_platform', 'instagram_permalink_url', 'source_instagram_media_id',
  'spend', 'impressions', 'reach', 'clicks', 'actions_link_click', 'actions_video_view', 'video_thruplay_watched_actions_video_view',
  'actions_post_reaction', 'actions_comment', 'actions_post', 'actions_onsite_conversion_post_save'];
const TIKTOK_AD_FIELDS = ['date', 'account_id', 'account_name', 'campaign_id', 'campaign_name', 'objective_type', 'ad_id', 'ad_name', 'item_id', 'identity_type',
  'spend', 'impressions', 'reach', 'clicks', 'total_play', 'organic_video_views', 'focused_view_6s', 'likes', 'comments', 'shares', 'follows', 'profile_visits'];

/** Ad-level daily rows for both Meta accounts (split by placement) and the TikTok account. Zero rows dropped. */
export async function fetchAds(range: string = 'last_7dT'): Promise<{ meta: AdDay[]; tiktok: AdDay[] }> {
  // range: a preset (last_7dT) or explicit dates "2026-07-01..2026-07-31" for back-fills.
  const m = range.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  const when = m ? { dateFrom: m[1], dateTo: m[2] } : { datePreset: range };
  const [meta, tiktok] = await Promise.all([
    windsor('facebook', META_AD_FIELDS, { ...when, accounts: Object.keys(META_ACCOUNTS) }),
    windsor('tiktok', TIKTOK_AD_FIELDS, { ...when, accounts: Object.keys(TIKTOK_ACCOUNTS) }),
  ]);
  return { meta: mapMetaAds(meta), tiktok: mapTikTokAds(tiktok) };
}

/* ---------- Our Instagram Stories (stats live for 24 hours only) ---------- */
export interface IgStory { id: string; account_id: string; platform: 'Instagram' | 'Instagram IE'; posted_at: string | null; permalink: string | null; thumb_url: string | null; views: number | null; reach: number | null; replies: number | null; shares: number | null; interactions: number | null; exits: number | null; taps_forward: number | null; taps_back: number | null; swipe_forward: number | null }
export function mapStories(rows: Row[]): IgStory[] {
  return rows.filter((r) => str(r.story_id)).map((r) => ({
    id: str(r.story_id), account_id: str(r.account_id), platform: str(r.account_id) === ACCOUNTS.instagramIE ? 'Instagram IE' : 'Instagram',
    posted_at: str(r.story_timestamp) ? new Date(str(r.story_timestamp).replace(/\+0000$/, 'Z')).toISOString() : null,
    permalink: str(r.story_permalink) || null, thumb_url: str(r.story_thumbnail_url) || null,
    views: num(r.story_views), reach: num(r.story_reach), replies: num(r.story_replies), shares: num(r.story_shares), interactions: num(r.story_interactions),
    exits: num(r.story_exits), taps_forward: num(r.story_taps_forward), taps_back: num(r.story_taps_back), swipe_forward: num(r.story_swipe_forward),
  }));
}
export async function fetchStories(): Promise<IgStory[]> {
  const rows = await windsor('instagram', ['account_id', 'date', 'story_id', 'story_timestamp', 'story_permalink', 'story_thumbnail_url', 'story_views', 'story_reach', 'story_replies', 'story_shares', 'story_interactions', 'story_exits', 'story_taps_forward', 'story_taps_back', 'story_swipe_forward'],
    { datePreset: 'last_3dT', accounts: [ACCOUNTS.instagramUK, ACCOUNTS.instagramIE] });
  return mapStories(rows);
}
