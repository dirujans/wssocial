// Pure helpers for the Our Audience page: flavour detection, sentiment, demographics and the latest-day summary.
// Sentiment is keyword rules: a pointer to read the comments, never a verdict.
import type { AccountDay, AudienceDemo, Comment, Mention } from './types';

export interface Flavour { name: string; re: RegExp; colour: string; lto?: boolean }

/** The UK core ten plus the current LTOs. Patterns are loose on purpose: people misspell flavours. */
export const FLAVOURS: Flavour[] = [
  { name: 'Lemon Pepper', re: /lemon\s*pep+er|\blemon\b(?!\s*(juice|ade))/i, colour: '#ffcf00' },
  { name: 'Mango Habanero', re: /mango|habanero|habenero/i, colour: '#ff7500' },
  { name: 'Atomic', re: /atomic/i, colour: '#fa0009' },
  { name: 'Original Hot', re: /original\s*hot|og hot/i, colour: '#ff4d4f' },
  { name: 'Cajun', re: /cajun/i, colour: '#ff7470' },
  { name: 'Louisiana Rub', re: /louisiana|\brub\b/i, colour: '#ff9a7a' },
  { name: 'Garlic Parmesan', re: /garlic|parm(esan|esean)?\b/i, colour: '#dec282' },
  { name: 'Hickory Smoked BBQ', re: /hickory|\bbbq\b|barbe?cue/i, colour: '#902f62' },
  { name: 'Spicy Korean Q', re: /korean|\bk-?q\b/i, colour: '#c58bd9' },
  { name: 'Hawaiian', re: /hawaii?an/i, colour: '#00b5b9' },
  { name: 'Hot Honey', re: /hot\s*hon+ey|\bhoney\b/i, colour: '#f5a524', lto: true },
  { name: 'Sriracha Hot Honey', re: /sriracha|siracha|sirracha/i, colour: '#e8432e', lto: true },
];

const POS = /(love|lov+e|best|fire|🔥|😍|🤤|❤|💯|goat|obsessed|so good|banging|bangin|peak|elite|unreal|amazing|incredible|delicious|tasty|slaps|hits different|addicted|need (it|this|more)|top tier|favourite|fav\b|class\b|lush|perfect|insane|(?:^|\s)w(?:\s|$)|🙌|😋)/i;
const NEG = /(worst|disgust|vile|\brank\b|\bcold\b|soggy|overpriced|too expensive|rip ?off|\bmid\b|bland|tasteless|no flavour|dry\b|\braw\b|rubbish|trash|disappoint|never again|salty|too sweet|sickly|tiny|small portion|refund|wrong order|🤮|👎|\bl\b|ruined|gone downhill|not the same|discontinued)/i;

export type Sentiment = 'positive' | 'negative' | 'mixed' | 'neutral';
export function sentimentOf(text: string): Sentiment {
  const p = POS.test(text), n = NEG.test(text);
  return p && n ? 'mixed' : p ? 'positive' : n ? 'negative' : 'neutral';
}

/** Flavours named in a piece of text. "Sriracha Hot Honey" also contains "hot honey", so that phrase counts only once, as Sriracha. */
export function flavoursIn(text: string): string[] {
  const rest = text.replace(/sri?r+acha\s*hot\s*hon+ey|hot\s*hon+ey\s*sri?r+acha/gi, ' sriracha ');
  return FLAVOURS.filter((f) => f.re.test(f.name === 'Hot Honey' ? rest : text)).map((f) => f.name);
}

export interface FlavourScore {
  name: string; colour: string; lto: boolean;
  mentions: number; positive: number; negative: number; mixed: number; neutral: number;
  net: number | null;            // (positive - negative) / mentions, -1..1
  likes: number;                 // likes on comments that name it: how loud the room is
  unprompted: number;            // mentions elsewhere (not under our posts)
  top: { text: string; likes: number; platform: string } | null;
}

export function flavourScores(comments: Pick<Comment, 'text' | 'likes' | 'platform'>[], mentions: Pick<Mention, 'title' | 'summary'>[]): FlavourScore[] {
  const base = new Map(FLAVOURS.map((f) => [f.name, { name: f.name, colour: f.colour, lto: !!f.lto, mentions: 0, positive: 0, negative: 0, mixed: 0, neutral: 0, net: null as number | null, likes: 0, unprompted: 0, top: null as FlavourScore['top'] }]));
  for (const c of comments) {
    const fs = flavoursIn(c.text);
    if (!fs.length) continue;
    const s = sentimentOf(c.text);
    for (const f of fs) {
      const b = base.get(f)!;
      b.mentions++; b[s]++; b.likes += c.likes ?? 0;
      if (s !== 'negative' && (!b.top || (c.likes ?? 0) > b.top.likes)) b.top = { text: c.text, likes: c.likes ?? 0, platform: c.platform };
    }
  }
  for (const m of mentions) {
    const text = `${m.title} ${m.summary ?? ''}`;
    for (const f of flavoursIn(text)) base.get(f)!.unprompted++;
  }
  return [...base.values()].map((b) => ({ ...b, net: b.mentions ? (b.positive - b.negative) / b.mentions : null }));
}

export interface Split { key: string; value: number; share: number }
const toSplit = (m: Map<string, number>): Split[] => {
  const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
  return [...m].map(([key, value]) => ({ key, value, share: value / total })).sort((a, b) => b.value - a.value);
};

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', '55+'];

/** Instagram gender/age counts → gender split and age bands (with the gender mix inside each band). */
export function instagramDemo(rows: AudienceDemo[], platforms = ['Instagram', 'Instagram IE']) {
  const ga = rows.filter((r) => platforms.includes(r.platform) && r.dimension === 'gender_age');
  const gender = new Map<string, number>(), age = new Map<string, { F: number; M: number; U: number }>();
  ga.forEach((r) => {
    const [g, a] = r.key.split('.');
    const label = g === 'F' ? 'Women' : g === 'M' ? 'Men' : 'Not stated';
    gender.set(label, (gender.get(label) ?? 0) + (r.value ?? 0));
    const cur = age.get(a) ?? { F: 0, M: 0, U: 0 };
    cur[(g as 'F' | 'M' | 'U')] = (cur[(g as 'F' | 'M' | 'U')] ?? 0) + (r.value ?? 0);
    age.set(a, cur);
  });
  const total = [...age.values()].reduce((s, v) => s + v.F + v.M + v.U, 0) || 1;
  const ages = [...age].map(([key, v]) => ({ key, ...v, total: v.F + v.M + v.U, share: (v.F + v.M + v.U) / total }))
    .sort((a, b) => AGE_ORDER.indexOf(a.key) - AGE_ORDER.indexOf(b.key));
  const cities = toSplit(new Map(rows.filter((r) => platforms.includes(r.platform) && r.dimension === 'city').map((r) => [r.key.replace(/, (England|Scotland|Wales|Northern Ireland|Dublin)$/, ''), r.value ?? 0])))
    .reduce((acc, c) => { const e = acc.find((x) => x.key === c.key); if (e) e.value += c.value; else acc.push({ ...c }); return acc; }, [] as Split[]);
  return { gender: toSplit(gender), ages, cities: cities.slice(0, 10), followersInAges: total };
}

/** TikTok shares (0..1) → age bands, gender split, and country split (from countries, or city prefixes if needed). */
export function tiktokDemo(rows: AudienceDemo[]) {
  const t = rows.filter((r) => r.platform === 'TikTok');
  const ages = t.filter((r) => r.dimension === 'age').map((r) => ({ key: r.key, share: r.value ?? 0 })).sort((a, b) => AGE_ORDER.indexOf(a.key) - AGE_ORDER.indexOf(b.key));
  const gender = t.filter((r) => r.dimension === 'gender').map((r) => ({ key: r.key === 'Female' ? 'Women' : r.key === 'Male' ? 'Men' : 'Other', value: r.value ?? 0, share: r.value ?? 0 })).sort((a, b) => b.share - a.share);
  let countries = t.filter((r) => r.dimension === 'country').map((r) => ({ key: r.key, share: r.value ?? 0 }));
  if (!countries.length) {
    const m = new Map<string, number>();
    t.filter((r) => r.dimension === 'city').forEach((r) => { const cc = r.key.split(' ')[0]; m.set(cc, (m.get(cc) ?? 0) + (r.value ?? 0)); });
    countries = [...m].map(([key, share]) => ({ key, share }));
  }
  countries.sort((a, b) => b.share - a.share);
  const cities = t.filter((r) => r.dimension === 'city' && !/ Other$/.test(r.key)).map((r) => ({ key: r.key.replace(/^[A-Z]{2} /, ''), cc: r.key.slice(0, 2), share: r.value ?? 0 })).sort((a, b) => b.share - a.share).slice(0, 8);
  return { ages, gender, countries: countries.slice(0, 6), cities };
}

export const totalOf = (rows: AudienceDemo[], platform: string, key = 'followers') => rows.find((r) => r.platform === platform && r.dimension === 'total' && r.key === key)?.value ?? null;

export interface DaySummary { date: string | null; views: number; likes: number; comments: number; shares: number; saves: number; reposts: number; follows: number; avg7: Record<string, number | null> }

/**
 * The latest complete day per platform (Instagram UK + IE together, TikTok separately), summed.
 * Platforms report by day, so this is "the last full day", not a rolling 24 hours. Also returns the
 * average of the 7 days before it, so each number can say whether it was a big day.
 */
export function latestDay(rows: AccountDay[]): { instagram: DaySummary; tiktok: DaySummary; total: DaySummary } {
  const pick = (ps: string[], has: (r: AccountDay) => boolean): DaySummary => {
    const rs = rows.filter((r) => ps.includes(r.platform));
    const dates = [...new Set(rs.filter(has).map((r) => r.date))].sort();
    const date = dates.at(-1) ?? null;
    const sum = (d: string | null, k: keyof AccountDay) => rs.filter((r) => r.date === d).reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const prev = dates.slice(-8, -1);
    const avg = (k: keyof AccountDay) => (prev.length ? prev.reduce((s, d) => s + sum(d, k), 0) / prev.length : null);
    const keys: (keyof AccountDay)[] = ['views', 'likes', 'comments', 'shares', 'saves', 'reposts', 'follows'];
    return {
      date, views: sum(date, 'views'), likes: sum(date, 'likes'), comments: sum(date, 'comments'), shares: sum(date, 'shares'),
      saves: sum(date, 'saves'), reposts: sum(date, 'reposts'), follows: sum(date, 'follows'),
      avg7: Object.fromEntries(keys.map((k) => [k, avg(k)])),
    };
  };
  const instagram = pick(['Instagram', 'Instagram IE'], (r) => (r.views ?? 0) > 0);
  const tiktok = pick(['TikTok'], (r) => (r.views ?? 0) > 0 || (r.likes ?? 0) > 0);
  const keys = ['views', 'likes', 'comments', 'shares', 'saves', 'reposts', 'follows'] as const;
  const total = { date: instagram.date, avg7: {} as Record<string, number | null> } as DaySummary;
  keys.forEach((k) => {
    total[k] = instagram[k] + tiktok[k];
    const a = instagram.avg7[k], b = tiktok.avg7[k];
    total.avg7[k] = a == null && b == null ? null : (a ?? 0) + (b ?? 0);
  });
  return { instagram, tiktok, total };
}

/** Sentiment split across a set of comments. */
export function sentimentSplit(comments: Pick<Comment, 'text'>[]) {
  const c = { positive: 0, negative: 0, mixed: 0, neutral: 0 };
  comments.forEach((x) => { c[sentimentOf(x.text)]++; });
  const opinionated = c.positive + c.negative + c.mixed;
  return { ...c, total: comments.length, positiveShare: opinionated ? c.positive / opinionated : null, negativeShare: opinionated ? c.negative / opinionated : null };
}

export type ReplyWhy = 'Question' | 'Funny' | 'Request' | 'Loud' | 'Wants in';
/**
 * Comments worth a reply-with-video: questions, the funny or absurd, city requests and the loudest.
 * Pushback is left out on purpose: complaints get a direct reply, not a video.
 */
/**
 * Reply-with-a-video candidates. Likes alone would pin the same old viral comments at the top for three weeks,
 * so the score halves every 4 days of post age: the bank turns over as new posts land. Comments already
 * marked used or skipped are taken out before the cut, so they never hold a slot.
 */
export function replyBank(comments: Pick<Comment, 'comment_id' | 'text' | 'likes' | 'theme' | 'platform' | 'post_link' | 'author' | 'post_date'>[], limit = 18, opts: { exclude?: Set<string>; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const FUNNY = /(😭|💀|😂|🤣|🫠|lmao|lmfao|i'm crying|im crying|dead|marry|propos|wedding|my mum|my mom|my nan|tattoo|divorce|ex\b|girlfriend|boyfriend|wife|husband|therapy|rent|salary|pay me|sponsor me)/i;
  const scored = comments.filter((c) => !opts.exclude?.has(c.comment_id) && c.theme !== 'Pushback' && c.text && c.text.replace(/@[\w.]+/g, '').trim().length > 3).map((c) => {
    const why: ReplyWhy[] = [];
    if (/\?/.test(c.text)) why.push('Question');
    if (FUNNY.test(c.text)) why.push('Funny');
    if (c.theme === "Where's ours?") why.push('Request');
    if (c.theme === 'Wants in') why.push('Wants in');
    if ((c.likes ?? 0) >= 50) why.push('Loud');
    const base = (c.likes ?? 0) * (1 + why.length) + (why.includes('Funny') ? 40 : 0) + (why.includes('Question') ? 20 : 0);
    const ageDays = c.post_date ? Math.max(0, (now - Date.parse(c.post_date + 'T12:00:00Z')) / 864e5) : 21;
    const score = base * Math.pow(0.5, ageDays / 4);
    return { c, why, score };
  }).filter((x) => x.why.length > 0);
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
