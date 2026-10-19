import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agencyOf, boosts, igPaidModel, mapMetaAds, mapTikTokAds, paidByDay, spikes, splitViews, totals } from '../lib/paid';

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
  assert.deepEqual(splitViews('2026-10-19', 'TikTok', 10000, p, null), { organic: 6000, paid: 4000, combined: 10000 });
  assert.deepEqual(splitViews('2026-10-19', 'Instagram', 10000, p, null), { organic: 10000, paid: 3000, combined: 13000 });
  assert.deepEqual(splitViews('2026-10-19', 'Instagram', 10000, p, 0.9), { organic: 7300, paid: 2700, combined: 10000 });
});

test('igPaidModel learns how much of account views is ads, and refuses without evidence', () => {
  assert.equal(igPaidModel(new Map([['2026-10-01', 5]]), paidByDay([])).includesAds, false);
  const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
  const ads = mapMetaAds(days.map((d, i) => ({ date: d, account_id: '1339656694773714', ad_id: '1', publisher_platform: 'instagram', spend: 1, impressions: i % 2 ? 100000 : 5000 })));
  const views = new Map(days.map((d, i) => [d, 50000 + 0.9 * (i % 2 ? 100000 : 5000) + (i % 3) * 1000]));
  const m = igPaidModel(views, paidByDay(ads));
  assert.equal(m.includesAds, true); assert.ok(Math.abs((m.k ?? 0) - 0.9) < 0.05);
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

test('packAds round-trips and merges non-Instagram Meta placements', async () => {
  const { packAds, unpackAds, totals, paidByDay } = await import('../lib/paid');
  const base = { platform: 'Meta' as const, ad_id: '1', account_id: 'a', account_name: 'A', agency: 'MSQ' as const, campaign_id: 'c', campaign: 'C', objective: 'o', ad_name: 'n', post_key: null, post_link: null, spark: null, reach: 1, clicks: 1, link_clicks: 1, video_views: 10, thruplays: 1, likes: 1, comments: 0, shares: 0, saves: 0, follows: null, profile_visits: null, organic_views: null };
  const rows = [
    { ...base, day: '2026-10-01', placement: 'instagram', spend: 10, impressions: 1000 },
    { ...base, day: '2026-10-01', placement: 'facebook', spend: 5, impressions: 500 },
    { ...base, day: '2026-10-01', placement: 'audience_network', spend: 1, impressions: 100 },
    { ...base, day: '2026-10-02', placement: 'messenger', spend: 0, impressions: 0 },
  ];
  const p = packAds(rows);
  assert.equal(p.ads.length, 1);
  assert.equal(p.rows.length, 2);
  const back = unpackAds(p);
  assert.deepEqual(totals(back).spend, totals(rows).spend);
  assert.equal(paidByDay(back).get('2026-10-01')!.igImpressions, 1000);
  assert.equal(back.find((r) => r.placement === 'other')!.video_views, 20);
});
