import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agencyOf, boosts, mapMetaAds, mapTikTokAds, paidByDay, paidShareCheck, spikes, splitViews, totals } from '../lib/paid';

test('agencyOf: campaign prefix wins, then account owner', () => {
  assert.equal(agencyOf('Meta', '1339656694773714', 'MSQ_REACH_HotHoney'), 'MSQ');
  assert.equal(agencyOf('Meta', '1339656694773714', 'TC | NSO'), 'Translate Culture');
  assert.equal(agencyOf('Meta', '1339656694773714', 'Something else'), 'MSQ');
  assert.equal(agencyOf('TikTok', '7031642344902426625', ''), 'Translate Culture');
});

test('mappers keep only rows with activity and link boosts to posts', () => {
  const meta = mapMetaAds([
    { date: '2026-10-19', account_id: '3120245488194717', campaign: 'TC | FLAVOUR CLUB', ad_id: '1', publisher_platform: 'instagram', instagram_permalink_url: 'https://www.instagram.com/p/ABC/', spend: 10, impressions: 1000, actions_video_view: 400 },
    { date: '2026-10-19', account_id: '3120245488194717', ad_id: '2', spend: 0, impressions: 0 },
  ]);
  assert.equal(meta.length, 1); assert.equal(meta[0].post_key, 'https://www.instagram.com/p/abc'); assert.equal(meta[0].agency, 'Translate Culture');
  const tt = mapTikTokAds([{ date: '2026-10-19', account_id: '7031642344902426625', ad_id: '9', item_id: '777', identity_type: 'BC_AUTH_TT', spend: 50, impressions: 5000, total_play: 4800, organic_video_views: 6000, follows: 20 }]);
  assert.equal(tt[0].spark, true); assert.equal(tt[0].post_key, '777'); assert.equal(tt[0].organic_views, 6000);
  assert.equal(totals([...meta, ...tt]).spend, 60);
});

test('splitViews: TikTok removes Spark plays from the account figure; Instagram only when ads are included', () => {
  const rows = mapTikTokAds([{ date: '2026-10-19', account_id: '7031642344902426625', ad_id: '9', item_id: '777', identity_type: 'BC_AUTH_TT', spend: 50, impressions: 5000, total_play: 4000 }])
    .concat(mapMetaAds([{ date: '2026-10-19', account_id: '1339656694773714', ad_id: '1', publisher_platform: 'instagram', spend: 10, impressions: 3000 }]));
  const p = paidByDay(rows);
  assert.deepEqual(splitViews('2026-10-19', 'TikTok', 10000, p, false), { organic: 6000, paid: 4000, combined: 10000 });
  assert.deepEqual(splitViews('2026-10-19', 'Instagram', 10000, p, false), { organic: 10000, paid: 3000, combined: 13000 });
  assert.deepEqual(splitViews('2026-10-19', 'Instagram', 10000, p, true), { organic: 7000, paid: 3000, combined: 10000 });
});

test('paidShareCheck needs evidence before saying account views include ads', () => {
  const p = paidByDay([]);
  assert.equal(paidShareCheck(new Map([['2026-10-01', 5]]), p).includesAds, null);
});

test('boosts compare organic views with unboosted peers', () => {
  const post = (k: string, views: number, platform = 'Instagram') => ({ comment_key: k, platform, posted: '2026-10-10', views, likes: 0, comments: 0, shares: 0, saves: 0, caption: '', permalink: null, thumb_url: null, kind: 'Reel' });
  const posts = [post('a', 20000), post('b', 10000), post('c', 10000), post('d', 10000), post('e', 10000)];
  const ads = mapMetaAds([{ date: '2026-10-11', account_id: '1339656694773714', campaign: 'MSQ_X', ad_id: '1', publisher_platform: 'instagram', instagram_permalink_url: 'a', spend: 100, impressions: 50000 }]);
  const b = boosts(ads, posts);
  assert.equal(b.length, 1); assert.equal(b[0].organicVsTypical, 2); assert.equal(b[0].lift, 3.5); assert.equal(b[0].costPer1kPaidViews, 2);
});

test('spikes label paid-driven days', () => {
  const series = Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`, platform: 'TikTok' as const, organic: 1000, paid: i === 29 ? 5000 : 0, spend: i === 29 ? 200 : 0 }));
  const s = spikes(series);
  assert.equal(s.length, 1); assert.equal(s[0].verdict, 'Paid');
});
