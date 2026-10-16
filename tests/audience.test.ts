import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flavourScores, flavoursIn, instagramDemo, latestDay, sentimentOf } from '../lib/audience';
import type { AccountDay, AudienceDemo } from '../lib/types';

test('flavoursIn separates Sriracha Hot Honey from Hot Honey', () => {
  assert.deepEqual(flavoursIn('Sriracha hot honey is unreal'), ['Sriracha Hot Honey']);
  assert.deepEqual(flavoursIn('hot honey > sriracha hot honey'), ['Hot Honey', 'Sriracha Hot Honey']);
  assert.deepEqual(flavoursIn('lemon pepper and mango hab every time'), ['Lemon Pepper', 'Mango Habanero']);
  assert.deepEqual(flavoursIn('the original post'), []);
});

test('sentimentOf reads common food slang', () => {
  assert.equal(sentimentOf('atomic is actually fire 🔥'), 'positive');
  assert.equal(sentimentOf('wings were cold and dry'), 'negative');
  assert.equal(sentimentOf('love it but overpriced'), 'mixed');
  assert.equal(sentimentOf('see you now'), 'neutral'); // "now" must not read as "W"
});

test('flavourScores counts sentiment, likes and the top quote', () => {
  const s = flavourScores([
    { text: 'Lemon pepper is the best', likes: 40, platform: 'Instagram' },
    { text: 'lemon pepper was bland today', likes: 5, platform: 'TikTok' },
    { text: 'Atomic', likes: 1, platform: 'TikTok' },
  ], [{ title: 'Creator rates lemon pepper', summary: null }]);
  const lp = s.find((f) => f.name === 'Lemon Pepper')!;
  assert.equal(lp.mentions, 2); assert.equal(lp.positive, 1); assert.equal(lp.negative, 1);
  assert.equal(lp.net, 0); assert.equal(lp.likes, 45); assert.equal(lp.unprompted, 1);
  assert.equal(lp.top?.likes, 40);
});

test('instagramDemo merges genders into age bands', () => {
  const rows: AudienceDemo[] = [['F.18-24', 10], ['M.18-24', 30], ['U.25-34', 60]].map(([key, value]) => ({ platform: 'Instagram', dimension: 'gender_age', key: String(key), value: Number(value), unit: 'count', snapshot_date: '2026-10-16' }));
  const d = instagramDemo(rows);
  assert.equal(d.ages[0].key, '18-24'); assert.equal(d.ages[0].total, 40); assert.equal(d.ages[0].share, 0.4);
  assert.equal(d.gender.find((g) => g.key === 'Not stated')?.share, 0.6);
});

test('latestDay uses each platform’s last real day and a 7-day average', () => {
  const mk = (date: string, platform: AccountDay['platform'], views: number, likes = 0): AccountDay => ({ date, platform, views, reach: null, likes, comments: 0, shares: 0, saves: 0, reposts: 0, interactions: null, profile_views: null, follows: 0 });
  const rows = [mk('2026-10-13', 'Instagram', 100), mk('2026-10-14', 'Instagram', 300), mk('2026-10-14', 'Instagram IE', 10), mk('2026-10-13', 'TikTok', 50, 5), mk('2026-10-15', 'TikTok', 0, 0)];
  const d = latestDay(rows);
  assert.equal(d.instagram.date, '2026-10-14'); assert.equal(d.instagram.views, 310); assert.equal(d.instagram.avg7.views, 100);
  assert.equal(d.tiktok.date, '2026-10-13'); assert.equal(d.total.views, 360);
});
