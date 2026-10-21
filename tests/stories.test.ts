import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapStories } from '../lib/windsor';

test('mapStories keeps story rows only and reads the timestamp', () => {
  const rows = [
    { account_id: '17841403911240491', date: '2026-10-19', story_id: null, media_caption: 'a reel' },
    { account_id: '17841403911240491', date: '2026-10-20', story_id: '178', story_timestamp: '2026-10-20T20:38:14+0000', story_permalink: 'https://www.instagram.com/stories/wingstopuk/1', story_thumbnail_url: null, story_views: 2971, story_reach: 2411, story_replies: 0, story_shares: 0, story_interactions: 16, story_exits: 628, story_taps_forward: 1778, story_taps_back: 182, story_swipe_forward: 123 },
    { account_id: '17841477228197665', date: '2026-10-21', story_id: '999', story_timestamp: '2026-10-21T08:00:00+0000', story_views: 10 },
  ];
  const s = mapStories(rows);
  assert.equal(s.length, 2);
  assert.equal(s[0].posted_at, '2026-10-20T20:38:14.000Z');
  assert.equal(s[0].views, 2971);
  assert.equal(s[0].thumb_url, null);
  assert.equal(s[1].platform, 'Instagram IE');
});
