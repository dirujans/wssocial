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
export function mapFcEntries(items: Row[], platform: 'TikTok' | 'Instagram'): Omit<FcEntry, 'status' | 'note'>[] {
  return items.filter((i) => !i.error && (i.id || i.shortCode)).map((i) => {
    if (platform === 'TikTok') {
      const a = (i.authorMeta ?? {}) as Row, vm = (i.videoMeta ?? {}) as Row;
      return { id: `tt_${str(i.id)}`, platform, author: str(a.name) || null, author_name: str(a.nickName) || null, url: str(i.webVideoUrl) || null, caption: str(i.text) || null,
        posted_at: str(i.createTimeISO) || null, likes: num(i.diggCount), comments: num(i.commentCount), plays: num(i.playCount), shares: num(i.shareCount), thumb_url: str(vm.coverUrl) || null, hashtag: FC_HASHTAG };
    }
    return { id: `ig_${str(i.id || i.shortCode)}`, platform, author: str(i.ownerUsername) || null, author_name: str(i.ownerFullName) || null, url: str(i.url) || null, caption: str(i.caption) || null,
      posted_at: str(i.timestamp) || null, likes: num(i.likesCount), comments: num(i.commentsCount), plays: num(i.videoPlayCount ?? i.videoViewCount), shares: null, thumb_url: str(i.displayUrl) || null, hashtag: FC_HASHTAG };
  });
}
