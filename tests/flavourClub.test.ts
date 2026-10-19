import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFc, isFcPost, mapFcEntries, opportunities } from '../lib/flavourClub';
import type { Comment } from '../lib/types';

const c = (text: string, likes = 1): Comment => ({ comment_id: text, platform: 'Instagram', text, likes, replies: null, author: null, commented_at: null, post_date: '2026-10-19', post_key: 'k', post_link: null, theme: 'Other' });

test('classifyFc sorts questions by topic, hype and pushback', () => {
  assert.equal(classifyFc(c('how do I sign up?')).topic, 'Sign-up');
  assert.equal(classifyFc(c('does it work in Dublin?')).topic, 'Where');
  assert.equal(classifyFc(c('how many stamps for a free meal?')).topic, 'Stamps and rewards');
  assert.equal(classifyFc(c('finally!! signed up 🔥')).theme, 'Hyped');
  assert.equal(classifyFc(c('not another app, just lower the prices')).theme, 'Pushback');
  assert.equal(classifyFc(c('pick me for founding member')).theme, 'Wants in');
});

test('isFcPost needs the club named, from October', () => {
  assert.equal(isFcPost({ caption: 'Introducing Wingstop Flavour Club.', posted: '2026-10-19' }), true);
  assert.equal(isFcPost({ caption: 'Loyal to my go-to order', posted: '2026-06-29' }), false);
});

test('opportunities turn repeated questions into actions', () => {
  const items = ['how do i join?', 'where do i sign up?', 'how to register?'].map((t) => classifyFc(c(t)));
  const o = opportunities(items, 0);
  assert.equal(o[0].title, 'People can’t see how to join');
  assert.equal(o[0].count, 3);
});

test('mapFcEntries reads TikTok and Instagram hashtag results', () => {
  const tt = mapFcEntries([{ id: '1', text: 'me #wingstopflavourclub', webVideoUrl: 'u', createTimeISO: '2026-10-20T10:00:00Z', diggCount: 5, playCount: 100, authorMeta: { name: 'fan' }, videoMeta: { coverUrl: 'c' } }], 'TikTok');
  assert.equal(tt[0].id, 'tt_1'); assert.equal(tt[0].author, 'fan'); assert.equal(tt[0].plays, 100);
  const ig = mapFcEntries([{ id: '9', ownerUsername: 'fan2', url: 'https://instagram.com/p/x', caption: 'x', hashtags: ['wingstopflavourclub'], timestamp: '2026-10-20T10:00:00Z', likesCount: 3, commentsCount: 1 }, { error: 'none' }], 'Instagram');
  assert.equal(ig.length, 1); assert.equal(ig[0].id, 'ig_9');
});

test('mapFcEntries drops loose hashtag matches and our own posts', () => {
  const out = mapFcEntries([
    { id: '2', text: 'Wingstop new menu #mukbang', authorMeta: { name: 'someone' } },
    { id: '3', text: 'Introducing Wingstop Flavour Club', authorMeta: { name: 'wingstopuk' } },
    { id: '4', text: 'pick me', hashtags: [{ name: 'wingstopflavourclub' }], authorMeta: { name: 'fan' } },
  ], 'TikTok');
  assert.deepEqual(out.map((o) => o.id), ['tt_4']);
});
