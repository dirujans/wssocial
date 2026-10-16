// Windsor.ai Connectors API. Docs: https://windsor.ai/api-information/
// The key only travels as a query parameter (Windsor does not accept header auth),
// so never log full URLs: HttpError masks it.

import { fetchWithRetry } from './http';
import { themeOf } from './themes';
import { NETWORK_TO_CHANNEL, type Comment, type Post, type ProfileDay } from './types';

const BASE = 'https://connectors.windsor.ai';

export const ACCOUNTS = {
  sprout: process.env.WINDSOR_SPROUT_ACCOUNT_ID ?? '2454071',
  instagramUK: process.env.WINDSOR_IG_UK_ID ?? '17841403911240491',
  instagramIE: process.env.WINDSOR_IG_IE_ID ?? '17841477228197665',
};

type Row = Record<string, unknown>;

async function windsor(connector: string, fields: string[], opts: { datePreset?: string; accounts?: string[] }): Promise<Row[]> {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) throw new Error('WINDSOR_API_KEY is not set');
  const qs = new URLSearchParams({ api_key: key, fields: fields.join(',') });
  if (opts.datePreset) qs.set('date_preset', opts.datePreset);
  if (opts.accounts?.length) qs.set('select_accounts', opts.accounts.join(','));
  const res = await fetchWithRetry(`${BASE}/${connector}?${qs}`);
  const json = (await res.json()) as { data?: Row[]; error?: string };
  if (!Array.isArray(json.data)) throw new Error(`Windsor ${connector}: ${json.error ?? 'no data in response'}`);
  return json.data;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const normLink = (u: unknown) => str(u).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();

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
export async function fetchPosts(datePreset = 'last_60d'): Promise<Post[]> {
  const rows = await windsor(
    'sproutsocial',
    ['post_guid', 'post_created_time', 'post_network', 'post_type', 'post_text', 'post_permalink', 'post_impressions', 'post_video_views', 'post_likes', 'post_comments', 'post_shares', 'post_saves'],
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
      views: vv != null && vv > 0 ? vv : imp,
      likes, comments, shares, saves, engagements,
      engagement_rate: imp ? engagements / imp : null,
      comment_key: guid.startsWith('tktvid:') ? guid.slice(7) : normLink(r.post_permalink),
    });
  }
  return [...out.values()];
}

export async function fetchComments(datePreset = 'last_14d'): Promise<Comment[]> {
  const [ig, tt] = await Promise.all([
    windsor(
      'instagram',
      ['account_id', 'date', 'media_permalink', 'comment_id', 'comment_text', 'comment_like_count', 'comment_reply_count', 'comment_timestamp'],
      { datePreset, accounts: [ACCOUNTS.instagramUK, ACCOUNTS.instagramIE] },
    ),
    windsor('tiktok_organic', ['date', 'comment_video_id', 'comment_id', 'comment_text', 'comment_username', 'comment_likes'], { datePreset }),
  ]);
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
