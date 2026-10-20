// Flavour Club (loyalty) helpers: which posts are Flavour Club posts, what the comments are about, what to do next.
// Keyword rules: a pointer to read the comments, never a verdict.
import { sentimentOf, type Sentiment } from './audience';
import type { Comment, Media, Mention } from './types';

export const FC_LAUNCH = '2026-10-19';
export const FC_HASHTAG = 'wingstopflavourclub';
export const FC_SITE = 'https://www.flavourclub.co.uk';

/** A Flavour Club post or mention: names the club, the hashtag, the site or the founding-member hunt. */
export const FC_RE = /flavour\s*club|flavor\s*club|flavourclub|wingstopflavourclub|founding\s*member/i;
export const isFcText = (t: string | null | undefined) => FC_RE.test(String(t ?? ''));
export const isFcPost = (m: Pick<Media, 'caption' | 'posted'>) => isFcText(m.caption) && (m.posted ?? '') >= '2026-10-01';

export type FcTopic = 'Sign-up' | 'App and site' | 'Stamps and rewards' | 'Events and artists' | 'Where' | 'Founding member' | 'Other question';
const TOPICS: [FcTopic, RegExp][] = [
  ['Founding member', /founding|first member|win|competition|enter|entry|pick me|choose me|hashtag|#wingstopflavourclub/i],
  ['Sign-up', /sign ?up|join|register|how do (i|we|you)|how to|where do i|link|bio|code/i],
  ['App and site', /\bapp\b|download|ios|android|website|site|flavourclub\.co|login|log in|account|not working|error|crash/i],
  ['Stamps and rewards', /stamp|point|reward|free|earn|redeem|card|how many|tier|birthday|discount|deal/i],
  ['Events and artists', /event|artist|gig|concert|show|ticket|merch|drop|festival|meet/i],
  ['Where', /ireland|dublin|belfast|scotland|glasgow|wales|cardiff|my city|near me|uk only|my area|all stores|every store|deliveroo|uber|just eat/i],
];

export type FcTheme = 'Question' | 'Hyped' | 'Pushback' | 'Wants in' | 'Tagging a friend' | 'Other';
export interface FcComment { c: Comment; theme: FcTheme; topic: FcTopic | null; sentiment: Sentiment }

const PUSHBACK = /another app|too many apps|my data|scam|cap\b|waste|pointless|rubbish|why would|prices? up|expensive|overpriced|bring back|instead of|just lower|not worth/i;
const HYPE = /finally|about time|let'?s go|lets go|need this|signed up|sign me up|i'?m in|im in|joined|love this|w\b|🔥|🙌|❤|😍|🤤|yes+\b/i;
const WANTS_IN = /pick me|me please|choose me|i want|i need|founding|how do i win|enter/i;

export function classifyFc(c: Comment): FcComment {
  const t = c.text ?? '';
  const sentiment = sentimentOf(t);
  const isQ = /\?/.test(t) || /^(how|when|where|what|is|can|does|do|will|why)\b/i.test(t.trim());
  const topic = (TOPICS.find(([, re]) => re.test(t))?.[0] ?? (isQ ? 'Other question' : null)) as FcTopic | null;
  let theme: FcTheme = 'Other';
  if (isQ) theme = 'Question';
  else if (PUSHBACK.test(t) || sentiment === 'negative') theme = 'Pushback';
  else if (WANTS_IN.test(t)) theme = 'Wants in';
  else if (HYPE.test(t) || sentiment === 'positive') theme = 'Hyped';
  else if (/@[\w.]+/.test(t) && t.replace(/@[\w.]+/g, '').trim().length < 25) theme = 'Tagging a friend';
  return { c, theme, topic: isQ || theme === 'Wants in' ? topic : null, sentiment };
}

export interface Opportunity { title: string; detail: string; count: number; kind: 'answer' | 'content' | 'fix' | 'people' }

/**
 * Turn what people asked and said into things to do. Thresholds are small on purpose: in launch week a handful
 * of the same question is already a pattern worth a pinned comment.
 */
export function opportunities(items: FcComment[], entries: number): Opportunity[] {
  const out: Opportunity[] = [];
  const q = (topic: FcTopic) => items.filter((i) => i.theme === 'Question' && i.topic === topic);
  const n = (topic: FcTopic) => q(topic).length;
  if (n('Sign-up') >= 2) out.push({ kind: 'answer', count: n('Sign-up'), title: 'People can’t see how to join', detail: `${n('Sign-up')} asked how to sign up. Pin a reply with the link and say it in the first line of the next caption, not the last.` });
  if (n('App and site') >= 2) out.push({ kind: 'fix', count: n('App and site'), title: 'App or site friction', detail: `${n('App and site')} questions or problems with the app or site. Check them against support tickets before the founding-member post drives a second wave.` });
  if (n('Stamps and rewards') >= 2) out.push({ kind: 'content', count: n('Stamps and rewards'), title: 'Explain how stamps turn into rewards', detail: `${n('Stamps and rewards')} asked how earning works. A 15-second "how it works" video answers them all at once and travels better than a caption.` });
  if (n('Where') >= 2) out.push({ kind: 'answer', count: n('Where'), title: 'Where does it work?', detail: `${n('Where')} asked about their area or delivery. Be explicit about Ireland, delivery apps and every store.` });
  if (n('Events and artists') >= 2) out.push({ kind: 'content', count: n('Events and artists'), title: 'The events and artists are the hook', detail: `${n('Events and artists')} asked about events, artists or merch. That's the part people want; tease the first one.` });
  const pushback = items.filter((i) => i.theme === 'Pushback');
  if (pushback.length >= 3) out.push({ kind: 'fix', count: pushback.length, title: 'Pushback to get ahead of', detail: `${pushback.length} pushback comments (another app, prices, data). Answer the most-liked one in public, plainly.` });
  const wants = items.filter((i) => i.theme === 'Wants in').length;
  if (wants >= 3 || entries > 0) out.push({ kind: 'people', count: wants + entries, title: 'People want to be the founding member', detail: `${wants} comments asking in and ${entries} #wingstopflavourclub posts found. Reply to the best ones by name: being noticed is the reward.` });
  return out.sort((a, b) => b.count - a.count);
}

export const fcMentions = (ms: Mention[]) => ms.filter((m) => m.topic === 'flavour_club' || isFcText(`${m.title} ${m.summary ?? ''}`));

export interface FcEntry {
  id: string; platform: 'TikTok' | 'Instagram'; author: string | null; author_name: string | null; url: string | null; caption: string | null;
  posted_at: string | null; likes: number | null; comments: number | null; plays: number | null; shares: number | null; thumb_url: string | null;
  hashtag: string | null; status: string | null; note: string | null;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const str = (v: unknown) => (v == null ? '' : String(v));

/** Apify hashtag results (TikTok via clockworks/tiktok-scraper, Instagram via apify/instagram-hashtag-scraper) → entries. */
const OWN = /^(wingstopuk|wingstopie|wingstop_ie|wingstopireland|wingstop)$/i;
/** Hashtag search is loose (TikTok returned US Wingstop videos with no club tag), so an entry must actually name the club, and never be one of ours. */
export function isFcEntry(i: Row): boolean {
  const author = str(((i.authorMeta ?? {}) as Row).name || i.ownerUsername);
  if (OWN.test(author)) return false;
  const tags = Array.isArray(i.hashtags) ? (i.hashtags as unknown[]).map((h) => (typeof h === 'string' ? h : str((h as Row)?.name))).join(' ') : '';
  return isFcText(`${str(i.text || i.caption)} ${tags}`);
}

export function mapFcEntries(items: Row[], platform: 'TikTok' | 'Instagram'): Omit<FcEntry, 'status' | 'note'>[] {
  return items.filter((i) => !i.error && (i.id || i.shortCode) && isFcEntry(i)).map((i) => {
    if (platform === 'TikTok') {
      const a = (i.authorMeta ?? {}) as Row, vm = (i.videoMeta ?? {}) as Row;
      return { id: `tt_${str(i.id)}`, platform, author: str(a.name) || null, author_name: str(a.nickName) || null, url: str(i.webVideoUrl) || null, caption: str(i.text) || null,
        posted_at: str(i.createTimeISO) || null, likes: num(i.diggCount), comments: num(i.commentCount), plays: num(i.playCount), shares: num(i.shareCount), thumb_url: str(vm.coverUrl) || null, hashtag: FC_HASHTAG };
    }
    return { id: `ig_${str(i.id || i.shortCode)}`, platform, author: str(i.ownerUsername) || null, author_name: str(i.ownerFullName) || null, url: str(i.url) || null, caption: str(i.caption) || null,
      posted_at: str(i.timestamp) || null, likes: num(i.likesCount), comments: num(i.commentsCount), plays: num(i.videoPlayCount ?? i.videoViewCount), shares: null, thumb_url: str(i.displayUrl) || null, hashtag: FC_HASHTAG };
  });
}

// ---- Sign-up traffic (Bitly) ----
/** Known labels; any other utm_source shows under its own name ("digital_screen" becomes "Digital screen"). */
export type LinkChannel = string;
export const SOCIAL_CHANNELS: LinkChannel[] = ['TikTok', 'Instagram'];
export const INSTORE_CHANNELS: LinkChannel[] = ['Table tents', 'A-boards', 'Receipts'];
export const isSocial = (c: LinkChannel) => SOCIAL_CHANNELS.includes(c);
export const isInstore = (c: LinkChannel) => !isSocial(c) && c !== 'Other';
/** Links made without UTM tags, mapped by their Bitly title. Add to this when a new untagged link appears. */
const UNTAGGED: Record<string, LinkChannel> = { 'bit.ly/4ykeSfR': 'Instagram', 'bit.ly/4s0z9W0': 'TikTok' };
const SOURCE: Record<string, LinkChannel> = { tiktok: 'TikTok', instagram: 'Instagram', table_tent: 'Table tents', aboard: 'A-boards', receipt: 'Receipts', small_bag: 'Small bags', large_bag: 'Large bags' };
const label = (src: string) => { const t = src.replace(/[_-]+/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };

const params = (u: string | null | undefined) => { try { return new URL(String(u ?? '')).searchParams; } catch { return new URLSearchParams(); } };
export function linkChannel(bitlink: string, destination: string | null | undefined): LinkChannel {
  const src = (params(destination).get('utm_source') ?? '').toLowerCase();
  return SOURCE[src] ?? UNTAGGED[bitlink] ?? (src ? label(src) : 'Other');
}
/** Store from a table-tent destination: restaurant_name (underscores to spaces, known typos fixed) and the store code in utm_content. */
export function linkStore(destination: string | null | undefined): { store: string; code: string | null } | null {
  const p = params(destination); const n = p.get('restaurant_name');
  if (!n) return null;
  const store = n.replace(/_/g, ' ').replace(/^Edinburh\b/, 'Edinburgh').replace(/Sheperd's/, "Shepherd's").replace(/Tydfill$/, 'Tydfil');
  return { store, code: p.get('utm_content') };
}

export interface FcLinkDay { day: string; bitlink: string; destination: string | null; clicks: number; scans: number; total: number }
export interface LinkSummary {
  channels: { channel: LinkChannel; total: number; latest: number }[];
  days: { day: string; byChannel: Partial<Record<LinkChannel, number>>; total: number }[];
  stores: { store: string; code: string | null; total: number; latest: number }[];
  latestDay: string | null;
  social: number; instore: number;
}
/** Roll Bitly link-days up by channel, day and store, from a start day (inclusive). Test links (non-live destinations) are dropped. */
export function linkSummary(rows: FcLinkDay[], from: string): LinkSummary {
  const live = rows.filter((r) => r.day >= from && !/wingstop-testing/.test(r.destination ?? ''));
  const latestDay = live.reduce<string | null>((m, r) => (!m || r.day > m ? r.day : m), null);
  const ch = new Map<LinkChannel, { total: number; latest: number }>();
  const dm = new Map<string, { byChannel: Partial<Record<LinkChannel, number>>; total: number }>();
  const st = new Map<string, { store: string; code: string | null; total: number; latest: number }>();
  for (const r of live) {
    const c = linkChannel(r.bitlink, r.destination);
    const a = ch.get(c) ?? { total: 0, latest: 0 }; a.total += r.total; if (r.day === latestDay) a.latest += r.total; ch.set(c, a);
    const d = dm.get(r.day) ?? { byChannel: {}, total: 0 }; d.byChannel[c] = (d.byChannel[c] ?? 0) + r.total; d.total += r.total; dm.set(r.day, d);
    const s = c === 'Table tents' ? linkStore(r.destination) : null;
    if (s) { const k = s.code ?? s.store; const x = st.get(k) ?? { ...s, total: 0, latest: 0 }; x.total += r.total; if (r.day === latestDay) x.latest += r.total; st.set(k, x); }
  }
  // Social first (always shown), then every in-store placement by size, known ones always present; Other last.
  const names = new Set<LinkChannel>([...SOCIAL_CHANNELS, ...INSTORE_CHANNELS, ...ch.keys()]);
  const channels = [...names].map((channel) => ({ channel, ...(ch.get(channel) ?? { total: 0, latest: 0 }) }))
    .sort((a, b) => (isSocial(a.channel) ? 0 : a.channel === 'Other' ? 2 : 1) - (isSocial(b.channel) ? 0 : b.channel === 'Other' ? 2 : 1) || (isSocial(a.channel) ? 0 : b.total - a.total));
  const sumOf = (f: (c: LinkChannel) => boolean) => channels.filter((c) => f(c.channel)).reduce((s, c) => s + c.total, 0);
  return {
    channels, latestDay,
    days: [...dm.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
    stores: [...st.values()].sort((a, b) => b.total - a.total),
    social: sumOf(isSocial), instore: sumOf(isInstore),
  };
}

export interface FcStore { code: string; name: string; place: string | null; region: string | null; lat: number | null; lng: number | null }

// ---- Social listening: signals in the comments (keyword rules, a pointer to read them, never a verdict) ----
export type FcSignal = 'Signed up' | 'Wants to join' | 'Asking how' | 'Tagging mates' | 'Catchphrase' | 'The music' | 'Cast spotted' | 'Funny' | 'Delivery apps' | 'Old orders' | 'Wants an app' | 'Wants a store' | 'Pushback' | 'Pure emoji';
export const FC_SIGNALS: FcSignal[] = ['Signed up', 'Wants to join', 'Asking how', 'Tagging mates', 'Catchphrase', 'The music', 'Cast spotted', 'Funny', 'Delivery apps', 'Old orders', 'Wants an app', 'Wants a store', 'Pushback', 'Pure emoji'];
/** Our own replies (TikTok gives the author; Instagram doesn't give commenter names, so ours can't be told apart there). */
export const isOwnAuthor = (a: string | null | undefined) => /^(wingstopuk|wingstopie|wingstop_ie|wingstopireland|wingstop)$/i.test(a ?? '');
const SIG: [FcSignal, RegExp][] = [
  ['Signed up', /\b(signed up|singed up|js signed|just joined|i joined|joined (it|already|today)|registered|got mine|signing up for mine|after signing up|i'?m (a )?member|already a member|done ✅|got my (card|stamp))/i],
  ['Wants to join', /sign me up|signing up|omw to sign|i need this|i'?m in\b|im in\b|need this|i want (in|to be)|want to be (a )?part|count me in|where do i sign|let me in|how do i (join|sign|get)/i],
  ['Asking how', /\bhow (do|does|can|to)\b|\bis it free\b|\bwhere (do|can|is)\b|\bwhat do (i|you) get\b|\blink\??$|\bhow many\b|\bwhen (does|is|will)\b/i],
  ['Catchphrase', /what (you|u|ya) know (bout|about) flavou?r/i],
  ['The music', /\btune|soundtrack|\baudio\b|anthem|\bsong\b|on repeat|the track|in the booth|bless the|tracksontap|wizxrdmusic|🎵|🎶|🔊/i],
  ['Cast spotted', /\bcast\b|familiar face|is that me|was that|did i see|certified|that'?s (my|our)|spotted|\bcameo\b|angelina/i],
  ['Funny', /😂|🤣|😭|💀|\blol\b|\blmao|\bhaha|\bdead\b|\bcrying\b|\bi'?m weak\b|stealing this/i],
  ['Delivery apps', /deliveroo|\broo\b|uber ?eats|just ?eat|delivery/i],
  ['Old orders', /past orders?|backed up|back ?date|claim back|orders? from \d+ days|left my receipt|old receipts?|so many points by now|years? of ordering/i],
  ['Wants an app', /need an app|make an app|get an app|an app,? please|no app|apple wallet|google wallet|phone storage/i],
  ['Wants a store', /(branch|store|shop|wingstop|one) (in|near|to) [a-z]|when (is|does) .* open|come to [A-Z]|open (one )?in [a-z]|need (a|one) in/i],
];
const PLACE_RE = /(?:branch|store|shop|wingstop|one|open|opening|come to|coming to) (?:in|to|near) ([A-Za-z][a-zA-Z'-]{2,}(?: [A-Z][a-zA-Z'-]{2,})?)/;
const NOT_PLACE = /^(the|this|that|wingstop|flavour|club|uk|me|my|your|our|town|area|city|here|there|every|all|time)$/i;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const isEmojiOnly = (t: string) => t.replace(/@[\w.]+/g, '').replace(EMOJI_RE, '').replace(/[\s‍️!.?]/g, '') === '' && EMOJI_RE.test(t);

export interface FcListen { signals: FcSignal[]; tags: number; place: string | null; emojis: string[] }
export function listen(item: FcComment): FcListen {
  const t = item.c.text ?? '';
  const signals = SIG.filter(([, re]) => re.test(t)).map(([s]) => s);
  const tags = (t.match(/@[\w.]+/g) ?? []).filter((h) => !/^@wingstop/i.test(h)).length;
  if (tags > 0) signals.push('Tagging mates');
  if (item.theme === 'Pushback') signals.push('Pushback');
  if (isEmojiOnly(t)) signals.push('Pure emoji');
  // A "how do I join" question is a sign of intent too.
  if (item.theme === 'Question' && item.topic === 'Sign-up' && !signals.includes('Wants to join')) signals.push('Wants to join');
  const m = t.match(PLACE_RE); const raw = (m?.[1] ?? '').trim();
  const place = signals.includes('Wants a store') ? (raw && !NOT_PLACE.test(raw) ? raw.replace(/^./, (c) => c.toUpperCase()) : null) : null;
  return { signals: [...new Set(signals)], tags, place, emojis: t.match(EMOJI_RE) ?? [] };
}

export interface FcListening {
  total: number;
  ladder: { step: 'Reacting' | 'Asking how' | 'Wants to join' | 'Says signed up'; n: number; note: string }[];
  signal: Record<FcSignal, number>;
  friendsTagged: number; tagShare: number;
  emojis: { e: string; n: number }[];
  places: { place: string; n: number }[];
  mood: { positive: number; negative: number; net: number | null };
}
/** Exec view of the comments: an intent ladder, advocacy (friends tagged), what's driving talk, emoji mood and store demand. */
export function listening(items: FcComment[]): FcListening {
  const ls = items.map((i) => ({ i, l: listen(i) }));
  const has = (s: FcSignal) => ls.filter((x) => x.l.signals.includes(s)).length;
  const signal = Object.fromEntries(FC_SIGNALS.map((s) => [s, has(s)])) as Record<FcSignal, number>;
  const signedUp = signal['Signed up'], wants = ls.filter((x) => x.l.signals.includes('Wants to join') && !x.l.signals.includes('Signed up')).length;
  const asking = ls.filter((x) => x.l.signals.includes('Asking how') && !x.l.signals.includes('Wants to join') && !x.l.signals.includes('Signed up')).length;
  const emo = new Map<string, number>();
  for (const x of ls) for (const e of new Set(x.l.emojis)) emo.set(e, (emo.get(e) ?? 0) + 1);
  const pl = new Map<string, number>();
  for (const x of ls) if (x.l.place) pl.set(x.l.place, (pl.get(x.l.place) ?? 0) + 1);
  const pos = items.filter((i) => i.sentiment === 'positive').length, neg = items.filter((i) => i.sentiment === 'negative' || i.theme === 'Pushback').length;
  return {
    total: items.length,
    ladder: [
      { step: 'Reacting', n: items.length - signedUp - wants - asking, note: 'Hype, tags, emoji: aware and warm' },
      { step: 'Asking how', n: asking, note: 'Questions about how it works' },
      { step: 'Wants to join', n: wants, note: '"Sign me up", "how do I join"' },
      { step: 'Says signed up', n: signedUp, note: 'Told us they joined' },
    ],
    signal,
    friendsTagged: ls.reduce((s, x) => s + x.l.tags, 0),
    tagShare: items.length ? signal['Tagging mates'] / items.length : 0,
    emojis: [...emo.entries()].map(([e, n]) => ({ e, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    places: [...pl.entries()].map(([place, n]) => ({ place, n })).sort((a, b) => b.n - a.n),
    mood: { positive: pos, negative: neg, net: pos + neg ? (pos - neg) / (pos + neg) : null },
  };
}

/** How club posts did against our usual posts on the same platform (median of the 90 days before launch). */
export function versusUsual(posts: Pick<Media, 'platform' | 'views' | 'shares' | 'saves' | 'comments'>[], baseline: { platform: string; views: number | null; shares: number | null; saves: number | null; comments: number | null }[]) {
  const med = (xs: number[]) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
  const out: { metric: 'views' | 'shares' | 'saves' | 'comments'; club: number | null; usual: number | null; index: number | null }[] = [];
  for (const metric of ['views', 'shares', 'saves', 'comments'] as const) {
    // Per platform first so TikTok's bigger numbers don't swamp Instagram, then averaged.
    const idx: number[] = []; const clubs: number[] = []; const usuals: number[] = [];
    for (const p of ['Instagram', 'TikTok']) {
      const c = med(posts.filter((x) => x.platform === p).map((x) => x[metric] ?? NaN)), u = med(baseline.filter((x) => x.platform === p).map((x) => x[metric] ?? NaN));
      if (c != null && u) { idx.push(c / u); clubs.push(c); usuals.push(u); }
    }
    out.push({ metric, club: clubs.length ? clubs.reduce((a, b) => a + b, 0) / clubs.length : null, usual: usuals.length ? usuals.reduce((a, b) => a + b, 0) / usuals.length : null, index: idx.length ? idx.reduce((a, b) => a + b, 0) / idx.length : null });
  }
  return out;
}
