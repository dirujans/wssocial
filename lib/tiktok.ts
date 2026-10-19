// Pure mapping and scoring for Apify results: competitor TikTok videos and UK trending hashtags.
import { brandOf } from './competitors';

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const str = (v: unknown) => (v == null ? '' : String(v));

/** TikTok handles we track (clockworks/tiktok-scraper). KFC's real account is kfc_uki; "kfcuki" is an unrelated fan account. */
export const TIKTOK_HANDLES = ['wingstopuk', 'kfc_uki', 'nandosuk', 'mcdonaldsuk', 'popeyesuk', 'daveshotchickenuk', 'raisingcanes', 'raisingcanes_uk'];

export const TIKTOK_BRANDS: Record<string, string> = {
  raisingcanes: "Raising Cane's (US)", raisingcanes_uk: "Raising Cane's UK (unverified)", daveshotchickenuk: "Dave's Hot Chicken UK&I",
};
export const tiktokBrand = (h: string) => TIKTOK_BRANDS[h] ?? brandOf(h).brand;

export interface TikTokVideo {
  id: string; handle: string; brand: string; posted_at: string | null; posted: string | null; caption: string; url: string | null; cover_url: string | null;
  plays: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; reposts: number | null;
  music: string | null; music_original: boolean | null; multiple: number | null; viral: boolean;
}
export interface TikTokAccountDay { date: string; handle: string; brand: string; fans: number | null; hearts: number | null; videos: number | null; verified: boolean | null }

export function mapTikTok(items: Row[], today: string): { videos: TikTokVideo[]; accounts: TikTokAccountDay[] } {
  const videos = new Map<string, TikTokVideo>(); const accounts = new Map<string, TikTokAccountDay>();
  for (const i of items) {
    if (i.error) continue;
    const a = (i.authorMeta ?? {}) as Row;
    const handle = str(a.name || i.input).toLowerCase();
    if (!handle) continue;
    if (!accounts.has(handle)) accounts.set(handle, { date: today, handle, brand: tiktokBrand(handle), fans: num(a.fans), hearts: num(a.heart), videos: num(a.video), verified: typeof a.verified === 'boolean' ? a.verified : null });
    if (!i.id || i.isAd || i.isSponsored) continue;
    const vm = (i.videoMeta ?? {}) as Row, mm = (i.musicMeta ?? {}) as Row;
    const iso = str(i.createTimeISO) || null;
    videos.set(str(i.id), {
      id: str(i.id), handle, brand: tiktokBrand(handle), posted_at: iso, posted: iso ? iso.slice(0, 10) : null, caption: str(i.text),
      url: str(i.webVideoUrl) || null, cover_url: str(vm.coverUrl) || null,
      plays: num(i.playCount), likes: num(i.diggCount), comments: num(i.commentCount), shares: num(i.shareCount), saves: num(i.collectCount), reposts: num(i.repostCount),
      music: str(mm.musicName) || null, music_original: typeof mm.musicOriginal === 'boolean' ? mm.musicOriginal : null, multiple: null, viral: false,
    });
  }
  return { videos: [...videos.values()], accounts: [...accounts.values()] };
}

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Score each video against its own account's median plays (TikTok is views-led). Breakout = 3x usual plays,
 * in the account's top 10%, 5+ videos to judge "usual" against, and at least 10k plays.
 * Run on everything we hold for the handle, not just the latest scrape, so "usual" is stable.
 */
export function scoreTikTok(videos: TikTokVideo[]): TikTokVideo[] {
  const by = new Map<string, number[]>();
  videos.forEach((v) => { if (v.plays != null) by.set(v.handle, [...(by.get(v.handle) ?? []), v.plays]); });
  const stats = new Map([...by].map(([h, xs]) => { const s = [...xs].sort((a, b) => a - b); return [h, { m: median(xs), n: xs.length, top: s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] ?? 0 }]; }));
  return videos.map((v) => {
    const s = stats.get(v.handle); const p = v.plays ?? 0;
    const multiple = s && s.m > 0 && v.plays != null ? p / s.m : null;
    return { ...v, multiple, viral: !!s && s.n >= 5 && multiple != null && multiple >= 3 && p >= s.top && p >= 10000 };
  });
}

export interface TrendRow { date: string; country: string; hashtag: string; rank: number | null; posts: number | null; views: number | null; direction: string | null; industries: string[]; url: string | null; series: { date: string; value: number }[]; top_creators: { handle: string; followers: number | null }[] }

/** data_xplorer/tiktok-trends hashtag rows (keys are human-readable, e.g. "Video Views"). */
export function mapTrends(items: Row[], today: string): TrendRow[] {
  return items.filter((i) => i.Hashtag).map((i) => ({
    date: today, country: str(i['Country Code'] || 'GB'), hashtag: str(i.Hashtag).replace(/^#/, ''),
    rank: num(i.Rank), posts: num(i.Posts), views: num(i['Video Views']), direction: str(i['Trend Direction']) || null,
    industries: Array.isArray(i.Industries) ? (i.Industries as unknown[]).map(str) : [], url: str(i['TikTok URL']) || null,
    series: Array.isArray(i['Trend Data']) ? (i['Trend Data'] as Row[]).map((d) => ({ date: str(d.date), value: num(d.value) ?? 0 })) : [],
    top_creators: Array.isArray(i['Top Creators']) ? (i['Top Creators'] as Row[]).slice(0, 5).map((c) => ({ handle: str(c.handle), followers: num(c.followers) })) : [],
  }));
}

/** Words that suggest a trend sits in Wingstop's territory (flavour, food, music, sport, youth culture, moments). A pointer, not a verdict. */
const FIT = /(food|chicken|wing|spicy|spice|hot|sauce|flavour|flavor|eat|mukbang|halal|recipe|honey|music|rap|drill|grime|dj|song|dance|football|premier|champions ?league|ucl|uefa|fpl|matchday|derby|mancity|manchesterunited|manutd|arsenal|chelsea|liverpool|tottenham|spurs|uni|student|fresher|halloween|bonfire|christmas|gta|black ?friday|half ?term|date ?night|weekend)/i;
const FIT_INDUSTRY = /(food|beverage|restaurant|sports|music|games)/i;
export function trendFit(t: Pick<TrendRow, 'hashtag' | 'industries'>): 'ours' | 'maybe' | 'skip' {
  if (FIT.test(t.hashtag)) return 'ours';
  if (t.industries.some((i) => FIT_INDUSTRY.test(i))) return 'maybe';
  return 'skip';
}
