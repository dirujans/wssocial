import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFc, isFcPost, linkChannel, linkStore, linkSummary, mapFcEntries, opportunities } from '../lib/flavourClub';
import type { Comment } from '../lib/types';
import { pickPlace } from '../lib/stores';

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

test('linkChannel and linkStore read UTM tags, with untagged links mapped by id', () => {
  assert.equal(linkChannel('bit.ly/flavourc-tt', 'https://www.flavourclub.co.uk/sign-up?utm_source=tiktok&utm_campaign=x'), 'TikTok');
  assert.equal(linkChannel('bit.ly/4ykeSfR', 'https://flavourclub.co.uk/'), 'Instagram');
  assert.equal(linkChannel('bit.ly/zzz', 'https://flavourclub.co.uk/'), 'Other');
  assert.deepEqual(linkStore('https://flavourclub.co.uk/sign-up?utm_source=table_tent&utm_content=2155&restaurant_name=Edinburh_St_James_Quarter'), { store: 'Edinburgh St James Quarter', code: '2155' });
  assert.equal(linkStore('https://flavourclub.co.uk/'), null);
});

test('linkSummary splits social and in-store, ranks stores and drops test links', () => {
  const tt = 'https://x.co/?utm_source=table_tent&utm_content=1&restaurant_name=A';
  const s = linkSummary([
    { day: '2026-10-19', bitlink: 'bit.ly/t', destination: 'https://x.co/?utm_source=tiktok', clicks: 208, scans: 0, total: 208 },
    { day: '2026-10-19', bitlink: 'bit.ly/i', destination: 'https://x.co/?utm_source=instagram', clicks: 2, scans: 0, total: 2 },
    { day: '2026-10-19', bitlink: 'bit.ly/a', destination: tt, clicks: 0, scans: 50, total: 50 },
    { day: '2026-10-18', bitlink: 'bit.ly/a', destination: tt, clicks: 0, scans: 5, total: 5 },
    { day: '2026-10-19', bitlink: 'bit.ly/x', destination: 'https://wingstop-testing.vercel.app/?utm_source=receipt', clicks: 0, scans: 9, total: 9 },
    { day: '2026-10-01', bitlink: 'bit.ly/a', destination: tt, clicks: 0, scans: 99, total: 99 },
  ], '2026-10-06');
  assert.equal(s.social, 210); assert.equal(s.instore, 55); assert.equal(s.latestDay, '2026-10-19');
  assert.deepEqual(s.stores[0], { store: 'A', code: '1', total: 55, latest: 50 });
  assert.equal(s.days.length, 2);
});

test('pickPlace prefers the exact name in the hinted region, then the bigger settlement', () => {
  const places = [
    { name_1: 'Stratford', local_type: 'Suburban Area', region: 'London', latitude: 51.54, longitude: -0.0 },
    { name_1: 'Stratford', local_type: 'Village', region: 'South West', latitude: 50.9, longitude: -1.8 },
    { name_1: 'Stratford-upon-Avon', local_type: 'Town', region: 'West Midlands', latitude: 52.19, longitude: -1.7 },
  ];
  assert.equal(pickPlace(places, { q: 'Stratford', region: /London/ })?.latitude, 51.54);
  assert.equal(pickPlace(places, { q: 'Stratford' })?.latitude, 51.54);
  assert.equal(pickPlace(places, { q: 'Nowhere' }), null);
  assert.equal(pickPlace(places, { q: 'Stratford', region: /Northern Ireland/ }), null);
});

test('unknown QR labels show under their own name and count as in-store', () => {
  assert.equal(linkChannel('bit.ly/q', 'https://flavourclub.co.uk/?utm_source=digital_screen&utm_medium=qr'), 'Digital screen');
  const s = linkSummary([{ day: '2026-10-20', bitlink: 'bit.ly/q', destination: 'https://x.co/?utm_source=digital_screen', clicks: 0, scans: 7, total: 7 }], '2026-10-19');
  assert.equal(s.instore, 7);
  assert.ok(s.channels.some((c) => c.channel === 'Digital screen' && c.total === 7));
});

test('listen: reads intent, advocacy, catchphrase, cast and store demand', async () => {
  const { classifyFc, listen, listening } = await import('../lib/flavourClub');
  const c = (text: string) => classifyFc({ comment_id: text, platform: 'Instagram', text, likes: 0, replies: null, author: null, commented_at: null, post_date: '2026-10-19', post_key: 'k', post_link: null, theme: 'Other' as never });
  assert.ok(listen(c('Signed up today 🔥🔥')).signals.includes('Signed up'));
  assert.ok(listen(c('Sign me up rn')).signals.includes('Wants to join'));
  assert.ok(listen(c('What you know about flavours?! @a @b')).signals.includes('Catchphrase'));
  assert.equal(listen(c('What you know about flavours?! @a @b')).tags, 2);
  assert.ok(listen(c('Did I see Angelina?!')).signals.includes('Cast spotted'));
  assert.ok(listen(c('🔥🔥🔥')).signals.includes('Pure emoji'));
  const s = listen(c('when is the branch in harrow opening'));
  assert.ok(s.signals.includes('Wants a store'));
  assert.equal(s.place, 'Harrow');
  const l = listening([c('Signed up today'), c('Sign me up'), c('How does it work?'), c('🔥'), c('@mate look')]);
  assert.equal(l.ladder.find((x) => x.step === 'Says signed up')!.n, 1);
  assert.equal(l.friendsTagged, 1);
});

test('fcPulse: Instagram ads add on top, TikTok Spark comes out of the post', async () => {
  const { fcPulse } = await import('../lib/flavourClub');
  const posts = [{ platform: 'TikTok' as const, comment_key: 't1', views: 1000, shares: 50, saves: 10 }, { platform: 'Instagram' as const, comment_key: 'i1', views: 400, shares: 20, saves: 5 }];
  const ads = [
    { platform: 'TikTok' as const, placement: 'tiktok', post_key: 't1', spark: true, impressions: 700, video_views: 600, shares: 2, saves: null, ad_name: 'x' },
    { platform: 'Meta' as const, placement: 'instagram', post_key: 'dark', spark: null, impressions: 300, video_views: 90, shares: 7, saves: 3, ad_name: 'y' },
    { platform: 'Meta' as const, placement: 'other', post_key: 'dark', spark: null, impressions: 999, video_views: 9, shares: 9, saves: 9, ad_name: 'y' },
  ];
  const p = fcPulse(posts, ads);
  assert.deepEqual(p.views.organic, { Instagram: 400, TikTok: 400 });
  assert.deepEqual(p.views.paid, { Instagram: 300, TikTok: 600 });
  assert.deepEqual(p.views.combined, { Instagram: 700, TikTok: 1000 });
  assert.deepEqual(p.shares.organic, { Instagram: 20, TikTok: 48 });
  assert.deepEqual(p.saves.paid, { Instagram: 3, TikTok: 0 });
});
