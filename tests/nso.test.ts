import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityLift, computeFit, parseCreatorCsv } from '../lib/nso';

test('parseCreatorCsv reads a Modash export with quoted numbers', () => {
  const csv = 'Username,Full Name,Platform,Followers,Engagement Rate,Audience Age 18-24,Audience Age 25-34,Audience Gender Female,Audience Credibility,Categories,Email\n@leedseats_,Sophie T,TikTok,"182,000",6.20%,41%,29%,54%,91%,Food;Lifestyle,s@x.co.uk\nspicyleeds,Kai,Instagram,94K,9.4%,45%,26%,47%,93%,Food;Spicy,';
  const r = parseCreatorCsv(csv);
  assert.equal(r.length, 2);
  assert.equal(r[0].followers, 182000); assert.equal(r[0].platform, 'tiktok');
  assert.ok(Math.abs((r[0].engagement_rate ?? 0) - 0.062) < 1e-9);
  assert.ok(Math.abs((r[0].fake_score ?? 0) - 0.09) < 1e-9);
  assert.deepEqual(r[0].categories, ['food', 'lifestyle']);
  assert.equal(r[1].handle, '@spicyleeds'); assert.equal(r[1].followers, 94000);
});

test('computeFit rescales when data is missing and flags it partial', () => {
  const full = computeFit({ platform: 'tiktok', followers: 182000, engagement_rate: 0.062, age1824: 0.41, age2534: 0.29, female_pct: 0.54, location_pct: 0.2, fake_score: 0.09, competitor_history: false, categories: ['food'], why: 'wings ranking' });
  assert.equal(full.partial, false);
  assert.ok(full.total > 70);
  const thin = computeFit({ platform: 'instagram', followers: null, engagement_rate: null, age1824: null, age2534: null, female_pct: null, location_pct: null, fake_score: null, competitor_history: null, categories: null, why: 'Manchester food reviewer' });
  assert.equal(thin.partial, true);
  assert.equal(thin.dims.reach, null);
});

test('cityLift measures change from the opening snapshot', () => {
  const rows = [
    { date: '2026-10-10', platform: 'Instagram', city: 'Romford, England', followers: 1000, unit: 'count' },
    { date: '2026-10-07', platform: 'Instagram', city: 'Romford, England', followers: 900, unit: 'count' },
    { date: '2026-10-16', platform: 'Instagram', city: 'Romford, England', followers: 1200, unit: 'count' },
    { date: '2026-10-16', platform: 'TikTok', city: 'GB Romford', followers: 0.01, unit: 'share' },
  ];
  const l = cityLift(rows, 'Romford', '2026-10-08');
  assert.equal(l.series.length, 3); assert.equal(l.atOpening?.followers, 900); assert.equal(l.change, 300);
});
