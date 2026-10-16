import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandOf, scoreboard, scorePosts } from '../lib/competitors';
import type { CompetitorPost } from '../lib/types';

const post = (handle: string, engagement: number, posted: string, extra: Partial<CompetitorPost> = {}): CompetitorPost => ({
  id: `${handle}_${engagement}_${posted}`, handle, brand: brandOf(handle).brand, platform: 'Instagram', posted_at: posted + 'T12:00:00Z', posted,
  kind: 'Reel', caption: '', permalink: null, media_url: null, thumb_url: null, likes: engagement, comments: 0, engagement,
  multiple: null, per_1k: null, viral: false, ...extra,
});

test('scorePosts flags a post at 2.5x the account median, per account', () => {
  const rows = [100, 120, 110, 90, 400].map((e, i) => post('kfcuki', e, `2026-10-0${i + 1}`))
    .concat([10000, 11000, 9000, 12000].map((e, i) => post('mcdonaldsuk', e, `2026-10-0${i + 1}`)));
  const s = scorePosts(rows, { kfcuki: 100000, mcdonaldsuk: 2000000 });
  const kfcBig = s.find((r) => r.handle === 'kfcuki' && r.engagement === 400)!;
  assert.equal(kfcBig.viral, true);
  assert.ok(Math.abs(kfcBig.multiple! - 400 / 110) < 1e-9);
  assert.equal(kfcBig.per_1k, 4);
  assert.equal(s.filter((r) => r.handle === 'mcdonaldsuk' && r.viral).length, 0);
});

test('scorePosts needs 4+ posts and 300+ engagement before calling a breakout', () => {
  const few = scorePosts([post('popeyesuk', 50, '2026-10-01'), post('popeyesuk', 500, '2026-10-02')], {});
  assert.equal(few.some((r) => r.viral), false);
  const small = scorePosts([10, 12, 11, 9, 60].map((e, i) => post('nandosuk', e, `2026-10-0${i + 1}`)), {});
  assert.equal(small.some((r) => r.viral), false);
});

test('scoreboard puts us first and counts this week vs last', () => {
  const posts = [post('raisingcanes', 500, '2026-10-14'), post('raisingcanes', 900, '2026-10-05', { viral: true }), post('wingstopuk', 300, '2026-10-15')];
  const days = [
    { date: '2026-10-08', handle: 'raisingcanes', platform: 'Instagram', brand: null, followers: 1000, media_count: 1 },
    { date: '2026-10-15', handle: 'raisingcanes', platform: 'Instagram', brand: null, followers: 1200, media_count: 2 },
  ];
  const b = scoreboard(posts, days, '2026-10-16');
  assert.equal(b[0].handle, 'wingstopuk');
  const c = b.find((x) => x.handle === 'raisingcanes')!;
  assert.equal(c.postsThisWeek, 1);
  assert.equal(c.postsLastWeek, 1);
  assert.equal(c.followersChange7, 200);
  assert.equal(c.viral30, 1);
  assert.equal(c.top?.engagement, 900);
});
