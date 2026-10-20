import 'server-only';
import type { TikTokAccountDay, TikTokVideo, TrendRow } from './tiktok';
import { fcMentions, FC_LAUNCH, isFcPost, isFcText, type FcEntry, type FcLinkDay, type FcStore } from './flavourClub';
import { shiftDay } from './metrics';
import { supabaseAdmin } from './supabase';
import type { AccountDay, Alert, AudienceDemo, CityDay, NsoCreator, NsoOpening, NsoPage, Comment, CompetitorAccountDay, CompetitorItem, CompetitorPost, Media, Mention, Post, ProfileDay } from './types';
import { packAds, type AdDay, type PackedAds, type PostLike } from './paid';

export interface DashboardData {
  days: ProfileDay[];
  posts: Post[];
  media: Media[];
  accountDays: AccountDay[];
  comments: Comment[];
  alerts: (Alert & { created_at: string })[];
  competitors: CompetitorItem[];
  mentions: Mention[];
  adsByDay: AdsByDay[];
  lastSync: { status: string; finished_at: string } | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function loadDashboard(): Promise<DashboardData> {
  const db = supabaseAdmin();
  const [d, p, m, a, c, al, co, me, s, ab] = await Promise.all([
    db.from('profile_daily').select('date,channel,impressions,engagements,followers,posts_sent').gte('date', shiftDay(today(), -125)).order('date'),
    db.from('posts').select('*').gte('posted', shiftDay(today(), -125)),
    db.from('media').select('*').gte('posted', shiftDay(today(), -125)).order('posted_at', { ascending: false }),
    db.from('account_daily').select('*').gte('date', shiftDay(today(), -125)).order('date'),
    db.from('comments').select('*').gte('post_date', shiftDay(today(), -30)).order('likes', { ascending: false }).limit(3000),
    db.from('alerts').select('*').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).eq('dismissed', false).order('created_at', { ascending: false }).limit(20),
    db.from('competitor_items').select('*').gte('posted_on', shiftDay(today(), -30)).order('posted_on', { ascending: false }).limit(40),
    db.from('mentions').select('*').eq('done', false).gte('posted_on', shiftDay(today(), -30)).order('posted_on', { ascending: false }).limit(60),
    db.from('sync_log').select('status,finished_at').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(1),
    db.from('ads_by_day').select('*').gte('day', shiftDay(today(), -125)).order('day'),
  ]);
  for (const r of [d, p, m, a, c, al, co, me, s, ab]) if (r.error) throw new Error(r.error.message);
  return {
    days: (d.data ?? []) as ProfileDay[],
    posts: (p.data ?? []) as Post[],
    media: (m.data ?? []) as Media[],
    accountDays: (a.data ?? []) as AccountDay[],
    comments: (c.data ?? []) as Comment[],
    alerts: (al.data ?? []) as DashboardData['alerts'],
    competitors: (co.data ?? []) as CompetitorItem[],
    mentions: (me.data ?? []) as Mention[],
    adsByDay: ((ab.data ?? []) as AdsByDay[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'day' ? v : Number(v ?? 0)])) as unknown as AdsByDay),
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
    db.from('sync_log').select('status,finished_at').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(1),
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
    db.from('sync_log').select('status,finished_at').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(1),
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

export interface FlavourClubData {
  posts: Media[];
  comments: Comment[];
  mentions: Mention[];
  entries: FcEntry[];
  marks: { key: string; verdict: string }[];
  loyalty: CompetitorItem[];
  links: FcLinkDay[];
  stores: FcStore[];
  /** Our non-club posts in the 90 days before launch, to read club posts against. */
  baseline: { platform: string; views: number | null; shares: number | null; saves: number | null; comments: number | null }[];
  lastSync: { status: string; finished_at: string } | null;
}

/** Everything Flavour Club: our club posts (Instagram and TikTok), their comments, hashtag entries, press and chatter, loyalty moves elsewhere. */
export async function loadFlavourClub(): Promise<FlavourClubData> {
  const db = supabaseAdmin();
  const since = shiftDay(FC_LAUNCH, -14);
  const [m, me, en, mk, co, s, ln, sto] = await Promise.all([
    db.from('media').select('*').gte('posted', since).order('posted_at', { ascending: false }),
    db.from('mentions').select('*').gte('posted_on', since).order('posted_on', { ascending: false }).limit(500),
    db.from('fc_entries').select('*').order('posted_at', { ascending: false, nullsFirst: false }).limit(1000),
    db.from('fc_marks').select('key,verdict'),
    db.from('competitor_items').select('*').gte('posted_on', shiftDay(today(), -180)).order('posted_on', { ascending: false }).limit(300),
    db.from('sync_log').select('status,finished_at').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(1),
    db.from('fc_link_days').select('day,bitlink,destination,clicks,scans,total').order('day').limit(50000),
    db.from('fc_stores').select('code,name,place,region,lat,lng'),
  ]);
  const bl = await db.from('media').select('platform,views,shares,saves,comments,caption,posted').gte('posted', shiftDay(FC_LAUNCH, -90)).lt('posted', FC_LAUNCH).in('platform', ['Instagram', 'TikTok']);
  if (bl.error) throw new Error(bl.error.message);
  for (const r of [m, me, en, mk, co, s, ln, sto]) if (r.error) throw new Error(r.error.message);
  const posts = ((m.data ?? []) as Media[]).filter(isFcPost);
  const keys = posts.map((p) => p.comment_key).filter(Boolean);
  const c = keys.length ? await db.from('comments').select('*').in('post_key', keys).order('likes', { ascending: false }).limit(5000) : { data: [], error: null };
  if (c.error) throw new Error(c.error.message);
  return {
    posts, comments: (c.data ?? []) as Comment[],
    mentions: fcMentions((me.data ?? []) as Mention[]),
    // Older loose hashtag matches stay in the table; only real entries (or ones the team already marked) show.
    entries: ((en.data ?? []) as FcEntry[]).filter((e) => e.status || (isFcText(e.caption) && !/^(wingstopuk|wingstopie|wingstop_ie|wingstopireland|wingstop)$/i.test(e.author ?? ''))),
    marks: (mk.data ?? []) as FlavourClubData['marks'],
    loyalty: ((co.data ?? []) as CompetitorItem[]).filter((i) => /loyal|reward|app\b|points|stamp|club/i.test(`${i.title} ${i.summary ?? ''}`)),
    links: (ln.data ?? []) as FcLinkDay[],
    stores: (sto.data ?? []) as FcStore[],
    baseline: ((bl.data ?? []) as (Media & { caption: string })[]).filter((x) => !isFcText(x.caption)).map(({ platform, views, shares, saves, comments }) => ({ platform, views, shares, saves, comments })),
    lastSync: (s.data?.[0] as FlavourClubData['lastSync']) ?? null,
  };
}

/* ---------- Paid ---------- */

export interface PaidData {
  packed: PackedAds;
  posts: PostLike[];
  accountDays: AccountDay[];
  lastSync: { status: string; finished_at: string } | null;
}

/** Supabase returns at most 1,000 rows a request, so page through. */
async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 60000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadPaid(): Promise<PaidData> {
  const db = supabaseAdmin();
  const since = shiftDay(today(), -125);
  const cols = 'day,platform,placement,ad_id,account_id,account_name,agency,campaign_id,campaign,objective,ad_name,post_key,post_link,spark,spend,impressions,reach,clicks,link_clicks,video_views,thruplays,likes,comments,shares,saves,follows,profile_visits,organic_views';
  const [ads, m, a, s] = await Promise.all([
    pageAll<AdDay>((f, t) => db.from('ads_daily').select(cols).gte('day', since).order('day').order('ad_id').order('placement').range(f, t)),
    db.from('media').select('comment_key,platform,posted,views,likes,comments,shares,saves,caption,permalink,thumb_url,kind').gte('posted', shiftDay(today(), -160)),
    db.from('account_daily').select('*').gte('date', since).order('date'),
    db.from('sync_log').select('status,finished_at').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(1),
  ]);
  for (const r of [m, a, s]) if (r.error) throw new Error(r.error.message);
  return {
    packed: packAds(ads.map((r) => ({ ...r, spend: Number(r.spend) }))),
    posts: (m.data ?? []) as PostLike[],
    accountDays: (a.data ?? []) as AccountDay[],
    lastSync: (s.data?.[0] as PaidData['lastSync']) ?? null,
  };
}

export interface AdsByDay { day: string; ig_impressions: number; ig_spend: number; ig_shares: number; ig_saves: number; tt_spark_plays: number; tt_plays: number; tt_spark_shares: number; tt_shares: number; tt_follows: number; tt_spend: number; spend: number }
