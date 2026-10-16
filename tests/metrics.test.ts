import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildAlerts } from '../lib/alerts';
import { headlines, lastCompleteDay, shiftDay, windowFor } from '../lib/metrics';
import { themeOf } from '../lib/themes';
import { NETWORK_TO_CHANNEL, type Comment, type ProfileDay } from '../lib/types';

// Raw Windsor rows (Sprout, 120 days to 15 Oct 2026), mapped the same way lib/windsor.ts does.
const raw = JSON.parse(readFileSync(new URL('./fixtures/profile_daily.json', import.meta.url), 'utf8')) as Record<string, unknown>[];
const days: ProfileDay[] = raw.map((r) => ({
  date: String(r.date),
  channel: NETWORK_TO_CHANNEL[String(r.profile_network_type)],
  impressions: r.profile_impressions == null ? null : Number(r.profile_impressions),
  engagements: r.profile_engagements == null ? null : Number(r.profile_engagements),
  followers: r.profile_followers == null ? null : Number(r.profile_followers),
  posts_sent: r.profile_posts_sent == null ? null : Number(r.profile_posts_sent),
}));

test('skips the lagging day Sprout has not filled in yet', () => {
  assert.equal(lastCompleteDay(days), '2026-10-14');
});

test('28-day headline figures match a hand count of the raw rows', () => {
  const w = windowFor('2026-10-14', 28);
  assert.deepEqual(w, { curFrom: '2026-09-17', curTo: '2026-10-14', prevFrom: '2026-08-20', prevTo: '2026-09-16' });
  const h = headlines(days, w, 'All');
  const hand = raw.filter((r) => String(r.date) >= w.curFrom && String(r.date) <= w.curTo).reduce((s, r) => s + (Number(r.profile_impressions) || 0), 0);
  assert.equal(h[0].current, hand);
  assert.equal(h[0].current, 26999023);
  assert.equal(h[1].current, 358570);
});

test('follower growth is null, not zero, when there is no earlier count', () => {
  const h = headlines(days, windowFor('2026-10-14', 60), 'All');
  const f = h.find((x) => x.metric === 'follower_growth')!;
  assert.equal(f.previous, null);
  assert.equal(f.change, null);
});

test('shiftDay crosses month ends', () => {
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30');
});

test('theme rules', () => {
  assert.equal(themeOf('come on now your better than this x'), 'Pushback');
  assert.equal(themeOf('Why no London💔'), "Where's ours?");
  assert.equal(themeOf('ME PLEASE LOOK AT MY BIRTHDAY CAKE'), 'Wants in');
  assert.equal(themeOf('@m4xhk'), 'Tagging a friend');
  assert.equal(themeOf('Louisiana rub, forever and always! 🔥'), 'Love');
  assert.equal(themeOf('Louisiana and big ranch'), 'Other');
});

test('alerts have stable ids so the same event only fires once', () => {
  const c: Comment = { comment_id: 'tt_1', platform: 'TikTok', text: 'come on now your better than this x', likes: 505, replies: null, author: 'someone', commented_at: null, post_date: '2026-10-14', post_key: '1', post_link: null, theme: 'Pushback' };
  const a1 = buildAlerts(days, [c]), a2 = buildAlerts(days, [c]);
  assert.deepEqual(a1.map((a) => a.id), a2.map((a) => a.id));
  const p = a1.find((a) => a.kind === 'pushback')!;
  assert.equal(p.severity, 'critical');
});
