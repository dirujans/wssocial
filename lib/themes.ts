import type { Theme } from './types';

// Keyword rules, first match wins. Deliberately simple and readable: a tag is a
// pointer to read the comment, never a verdict.
const RULES: [Theme, RegExp][] = [
  ['Pushback', /(better than this|worst|disgust|\bcold\b|soggy|overpriced|too expensive|rip ?off|refund|rude|never again|trash|\bmid\b|disappoint|cringe|boycott|\bick\b|\bdry\b|\braw\b|food poisoning|wrong order|missing)/i],
  ["Where's ours?", /(why (no|not)\b|what about|bring (this|it|wingstop|one)|come to|open (one|in|a)|not even|where is|when (are|is|will|u|you)|whe+n+\b|need one in|pls come|please come)/i],
  ['Wants in', /(me please|pick me|can i (have|get)|how do (i|we)|what do (we|i) (have|need) to|want one|i want|giveaway|enter\b|win\b|look at my|choose me|i need)/i],
];
const LOVE = /(love|best|fire|🔥|😍|❤|goat|obsessed|so good|banging|peak|elite|unreal|the one|hard)/i;
const TAG_ONLY = /^\s*(@[\w.]+[\s,]*)+[\s\S]{0,40}$/;

export function themeOf(text: string | null | undefined): Theme {
  const s = String(text ?? '');
  for (const [theme, re] of RULES) if (re.test(s)) return theme;
  if (s.includes('@') && TAG_ONLY.test(s)) return 'Tagging a friend';
  if (LOVE.test(s)) return 'Love';
  return 'Other';
}
