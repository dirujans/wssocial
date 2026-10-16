import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heat, lastSocialDay, needsReply, rankComments, socialToplines, weekStart, weeklyOutput } from '../lib/social';
import type { AccountDay, Comment, Media, Post } from '../lib/types';

const day = (date: string, platform: AccountDay['platform'], v: Partial<AccountDay>): AccountDay =>
  ({ date, platform, views: 100, reach: null, likes: 0, comments: 0, shares: 0, saves: 0, reposts: 0, interactions: 0, profile_views: null, follows: null, ...v });

test('social window ends on the latest day both platforms have filled in', () => {
  const rows = [day('2026-10-15', 'Instagram', {}), day('2026-10-14', 'TikTok', {}), day('2026-10-15', 'TikTok', { views: 0 })];
  assert.equal(lastSocialDay(rows), '2026-10-14');
});

test('toplines sum shares, add TikTok saves by video date, and compare with the period before', () => {
  const rows: AccountDay[] = [];
  for (let d = 1; d <= 14; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    rows.push(day(date, 'Instagram', { shares: d > 7 ? 20 : 10, saves: 1, reposts: 2 }));
    rows.push(day(date, 'TikTok', { shares: 5 }));
  }
  const media = [{ platform: 'TikTok', posted: '2026-10-12', saves: 40 } as Media, { platform: 'TikTok', posted: '2026-10-02', saves: 4 } as Media];
  const r = socialToplines(rows, media, 7, 'All')!;
  const get = (m: string) => r.toplines.find((t) => t.metric === m)!;
  assert.equal(r.to, '2026-10-14');
  assert.equal(get('shares').current, 7 * 20 + 7 * 5);
  assert.equal(get('shares').previous, 7 * 10 + 7 * 5);
  assert.equal(get('saves').current, 7 + 40);
  assert.equal(get('reposts').current, 14);
  assert.equal(socialToplines(rows, media, 7, 'Facebook'), null);
});

test('weekly output compares this week so far with the same days last week', () => {
  assert.equal(weekStart('2026-10-16'), '2026-10-12');
  const p = (posted: string, format: Post['format'] = 'Post') => ({ channel: 'TikTok', posted, format } as Post);
  const posts = [p('2026-10-12'), p('2026-10-14'), p('2026-10-05'), p('2026-10-10'), p('2026-10-13', 'Story')];
  const { rows, daysIn } = weeklyOutput(posts, '2026-10-16');
  assert.equal(daysIn, 5);
  const tt = rows.find((r) => r.channel === 'TikTok')!;
  assert.equal(tt.thisWeek, 2);
  assert.equal(tt.lastWeekSameDays, 1); // 10 Oct is a Saturday, outside Mon to Fri
  assert.equal(tt.lastWeek, 2);
});

test('comment ranking: questions and pushback need replies, heat favours likes and urgency', () => {
  const c = (text: string, likes: number, theme: Comment['theme'], replies: number | null = 0): Comment =>
    ({ comment_id: text, platform: 'Instagram', text, likes, replies, author: null, commented_at: '2026-10-15T12:00:00Z', post_date: '2026-10-14', post_key: 'k', post_link: null, theme });
  const q = c('When are you coming to Leeds?', 3, "Where's ours?");
  const love = c('love it', 3, 'Love');
  assert.equal(needsReply(q), true);
  assert.equal(needsReply(love), false);
  const now = +new Date('2026-10-16T00:00:00Z');
  assert.ok(heat(q, now) > heat(love, now));
  assert.deepEqual(rankComments([love, q], 'reply', now).map((x) => x.text), ['When are you coming to Leeds?']);
});
