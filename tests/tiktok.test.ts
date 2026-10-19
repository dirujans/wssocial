import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTikTok, mapTrends, scoreTikTok, trendFit } from '../lib/tiktok';

const vid = (handle: string, id: string, plays: number) => ({ id, input: handle, createTimeISO: '2026-10-10T12:00:00.000Z', text: 'x', webVideoUrl: `https://www.tiktok.com/@${handle}/video/${id}`, authorMeta: { name: handle, fans: 1000, heart: 5, video: 9, verified: true }, videoMeta: { coverUrl: 'c' }, musicMeta: { musicName: 'og', musicOriginal: true }, playCount: plays, diggCount: 1, commentCount: 1, shareCount: 2, collectCount: 3, repostCount: 0 });

test('mapTikTok reads plays, shares and saves, skips errors and ads', () => {
  const { videos, accounts } = mapTikTok([vid('kfc_uki', '1', 500), { input: 'slimchickensuk', error: 'does not exist' }, { ...vid('kfc_uki', '2', 9), isAd: true }], '2026-10-19');
  assert.equal(videos.length, 1); assert.equal(videos[0].saves, 3); assert.equal(videos[0].shares, 2); assert.equal(videos[0].brand, 'KFC UK&I');
  assert.equal(accounts.length, 1); assert.equal(accounts[0].fans, 1000);
});

test('scoreTikTok flags only real breakouts', () => {
  const plays = [10000, 12000, 11000, 9000, 10500, 9500, 80000];
  const { videos } = mapTikTok(plays.map((p, i) => vid('nandosuk', String(i), p)), '2026-10-19');
  const s = scoreTikTok(videos);
  assert.deepEqual(s.filter((v) => v.viral).map((v) => v.plays), [80000]);
  const few = scoreTikTok(mapTikTok([vid('a', 'x', 5000), vid('a', 'y', 90000)], 'd').videos);
  assert.equal(few.some((v) => v.viral), false);
});

test('mapTrends and trendFit', () => {
  const t = mapTrends([{ Rank: 1, Hashtag: '#halloweenfood', Posts: 100, 'Video Views': 5000, Industries: ['Food & Beverage'], 'Country Code': 'GB', 'Trend Direction': 'up', 'Trend Data': [{ date: '2026-10-12', value: 40 }], 'Top Creators': [{ handle: '@a', followers: 10 }] }], '2026-10-19');
  assert.equal(t[0].hashtag, 'halloweenfood'); assert.equal(t[0].views, 5000); assert.equal(t[0].series[0].value, 40);
  assert.equal(trendFit(t[0]), 'ours');
  assert.equal(trendFit({ hashtag: 'marvelrivalsavengers', industries: ['Games'] }), 'maybe');
  assert.equal(trendFit({ hashtag: 'championsleague', industries: [] }), 'ours');
  assert.equal(trendFit({ hashtag: 'makeupmania', industries: [] }), 'skip');
  assert.equal(trendFit({ hashtag: 'xyz', industries: ['Sports & Outdoor'] }), 'maybe');
});
