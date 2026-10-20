'use client';

import { useMemo, useState } from 'react';
import { FC_SIGNALS, type FcComment, type FcListen, type FcSignal } from '@/lib/flavourClub';
import type { Media } from '@/lib/types';
import { CHANNEL_COLOUR, compact, int, safeHref } from './format';

export const SIGNAL_ICON: Record<FcSignal, string> = {
  'Signed up': '✅', 'Wants to join': '🙋', 'Asking how': '❓', 'Tagging mates': '👯', Catchphrase: '🗣️', 'The music': '🎵', 'Cast spotted': '👀',
  Funny: '😂', 'Delivery apps': '🛵', 'Old orders': '🧾', 'Wants an app': '📱', 'Wants a store': '📍', Pushback: '😤', 'Pure emoji': '🔥',
};
export type Heard = FcComment & { l: FcListen; ours: boolean };
type Sort = 'liked' | 'shuffle' | 'longest';
type View = 'wall' | 'posts';

// Deterministic shuffle per seed, so the order holds still until "Shuffle" is pressed again.
function shuffled<T>(xs: T[], seed: number): T[] {
  const a = [...xs]; let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Every comment on the club posts, playable: filter by what people are doing, shuffle, search, or read post by post. */
export default function FcCommentWall({ heard, posts }: { heard: Heard[]; posts: Media[] }) {
  const fans = useMemo(() => heard.filter((h) => !h.ours), [heard]);
  const [signal, setSignal] = useState<FcSignal | 'all'>('all');
  const [sort, setSort] = useState<Sort>('liked');
  const [seed, setSeed] = useState(7);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('wall');
  const [showAll, setShowAll] = useState(false);
  const [pick, setPick] = useState<Heard | null>(null);

  const counts = useMemo(() => Object.fromEntries(FC_SIGNALS.map((s) => [s, fans.filter((h) => h.l.signals.includes(s)).length])) as Record<FcSignal, number>, [fans]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const xs = fans.filter((h) => (signal === 'all' || h.l.signals.includes(signal)) && (!needle || h.c.text.toLowerCase().includes(needle)));
    if (sort === 'shuffle') return shuffled(xs, seed);
    if (sort === 'longest') return [...xs].sort((a, b) => b.c.text.length - a.c.text.length);
    return [...xs].sort((a, b) => (b.c.likes ?? 0) - (a.c.likes ?? 0));
  }, [fans, signal, q, sort, seed]);
  const shown = showAll ? list : list.slice(0, 12);
  const deal = () => { const pool = list.length ? list : fans; if (pool.length) setPick(pool[Math.floor(Math.random() * pool.length)]); };

  return (
    <section className="band" id="comments-wall">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">{int(fans.length)} comments from fans on the club posts · tap a mood, shuffle, or read post by post</span><h2>The comment wall</h2></div>
          <div className="seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'wall'} onClick={() => setView('wall')}>Wall</button>
            <button type="button" aria-pressed={view === 'posts'} onClick={() => setView('posts')}>By post</button>
          </div>
        </div>

        <div className="wall-moods" role="group" aria-label="Filter by what people are doing">
          <button type="button" className="mood" aria-pressed={signal === 'all'} onClick={() => { setSignal('all'); setShowAll(false); }}><span className="mood-e">✨</span>Everything<span className="count">{int(fans.length)}</span></button>
          {FC_SIGNALS.filter((s) => counts[s] > 0).map((s) => (
            <button key={s} type="button" className="mood" aria-pressed={signal === s} onClick={() => { setSignal(s); setShowAll(false); }}><span className="mood-e">{SIGNAL_ICON[s]}</span>{s}<span className="count">{int(counts[s])}</span></button>
          ))}
        </div>

        {view === 'wall' ? (<>
          <div className="wall-tools">
            <div className="seg" role="group" aria-label="Order">
              <button type="button" aria-pressed={sort === 'liked'} onClick={() => setSort('liked')}>Most liked</button>
              <button type="button" aria-pressed={sort === 'shuffle'} onClick={() => { setSort('shuffle'); setSeed((x) => x + 1); }}>🔀 Shuffle</button>
              <button type="button" aria-pressed={sort === 'longest'} onClick={() => setSort('longest')}>Longest reads</button>
            </div>
            <input type="search" placeholder="Search comments" value={q} onChange={(e) => { setQ(e.target.value); setShowAll(false); }} aria-label="Search comments" />
            <button type="button" className="chip primary" onClick={deal}>🎲 Deal me one</button>
          </div>

          {pick && (
            <div className="spotlight" style={{ marginTop: 14 }}>
              <span className="eyebrow" style={{ opacity: 0.7 }}>Random pick · {pick.c.platform}{pick.l.signals[0] ? ` · ${SIGNAL_ICON[pick.l.signals[0]]} ${pick.l.signals[0]}` : ''}</span>
              <div className="q" style={{ marginTop: 8 }}>&ldquo;{pick.c.text}&rdquo;</div>
              <div className="meta"><span className="likes">{int(pick.c.likes)}</span><span>likes</span>{safeHref(pick.c.post_link) && <a href={safeHref(pick.c.post_link)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>See the post</a>}<button type="button" className="chip" onClick={deal}>Another</button><button type="button" className="chip" onClick={() => setPick(null)}>Close</button></div>
            </div>
          )}

          {list.length === 0 ? <p className="empty">Nothing matches. Try another mood or clear the search.</p> : (
            <div className="wall" style={{ marginTop: 14 }}>
              {shown.map((h) => <WallCard key={h.c.comment_id} h={h} />)}
            </div>
          )}
          {list.length > 12 && <button type="button" className="chip" style={{ marginTop: 12 }} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `Show all ${int(list.length)}`}</button>}
        </>) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {posts.map((p) => {
              const all = heard.filter((h) => h.c.post_key === p.comment_key && (signal === 'all' || h.l.signals.includes(signal) || h.ours));
              const fanN = all.filter((h) => !h.ours).length;
              return (
                <details key={p.id} className="card post-thread">
                  <summary>
                    <span className="plat"><i style={{ background: CHANNEL_COLOUR[p.platform] }} />{p.platform}</span>
                    <b className="post-cap">{(p.caption || '(no caption)').split('\n')[0].slice(0, 90)}</b>
                    <span className="muted">{int(fanN)} comments{all.some((h) => h.ours) ? `, ${all.filter((h) => h.ours).length} replies from us` : ''} · {compact(p.views)} views</span>
                  </summary>
                  <div className="thread">
                    {all.length === 0 ? <p className="empty">No comments in this mood on this post.</p> : [...all].sort((a, b) => Number(a.ours) - Number(b.ours) || (b.c.likes ?? 0) - (a.c.likes ?? 0)).map((h) => (
                      <div key={h.c.comment_id} className={`thread-row ${h.ours ? 'ours' : ''}`}>
                        <span className="who">{h.ours ? 'Us' : h.c.author ? `@${h.c.author}` : 'Fan'}</span>
                        <span className="what">{h.c.text}</span>
                        <span className="icons" aria-label={h.l.signals.join(', ')}>{h.l.signals.slice(0, 3).map((s) => <span key={s} title={s}>{SIGNAL_ICON[s]}</span>)}</span>
                        <span className="n">{int(h.c.likes)}♥</span>
                      </div>
                    ))}
                    {safeHref(p.permalink) && <a href={safeHref(p.permalink)} target="_blank" rel="noopener noreferrer" className="chip" style={{ justifySelf: 'start', marginTop: 6 }}>Open the post</a>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
        <p className="note" style={{ marginTop: 12 }}>Moods are keyword rules, so a comment can sit in more than one and some will be wrong: read before quoting. Our own TikTok replies are left out of the wall and counts (TikTok names the author; Instagram doesn&apos;t give commenter names, so any Instagram replies from us stay in).</p>
      </div>
    </section>
  );
}

function WallCard({ h }: { h: Heard }) {
  const big = !/@/.test(h.c.text) && h.c.text.trim().length < 34;
  return (
    <div className={`wall-card ${big ? 'big' : ''}`}>
      <div className="wall-text">{h.c.text}</div>
      <div className="meta">
        <span className="likes-n">{int(h.c.likes)}</span> likes
        <span className="plat"><i style={{ background: CHANNEL_COLOUR[h.c.platform] }} />{h.c.platform}</span>
        {h.l.signals.slice(0, 3).map((s) => <span key={s} className="sig" title={s}>{SIGNAL_ICON[s]} {s}</span>)}
        {(h.c.replies ?? 0) > 0 && <span>{int(h.c.replies)} replies</span>}
        {safeHref(h.c.post_link) && <a href={safeHref(h.c.post_link)} target="_blank" rel="noopener noreferrer">Post</a>}
      </div>
    </div>
  );
}
