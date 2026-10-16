'use client';

import { useMemo, useState } from 'react';
import type { ChannelFilter } from '@/lib/metrics';
import { heat, needsReply, rankComments, type CommentRank } from '@/lib/social';
import { THEMES, type Comment, type Media, type Post, type Theme } from '@/lib/types';
import { ago, day, int, safeHref } from './format';

const RANKS: [CommentRank, string][] = [['hot', 'Hottest'], ['liked', 'Most liked'], ['reply', 'Needs a reply'], ['newest', 'Newest']];

export default function CommentsArena({ comments, posts, media, channel }: { comments: Comment[]; posts: Post[]; media: Media[]; channel: ChannelFilter }) {
  const [rank, setRank] = useState<CommentRank>('hot');
  const [theme, setTheme] = useState<Theme | 'All'>('All');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(18);
  const now = useMemo(() => Date.now(), []);

  const caption = useMemo(() => {
    const m = new Map<string, string>();
    posts.forEach((p) => p.text && m.set(p.comment_key, p.text));
    media.forEach((x) => x.caption && m.set(x.comment_key, x.caption));
    return m;
  }, [posts, media]);

  const scoped = useMemo(() => {
    const cut = new Date(now - 14 * 864e5).toISOString().slice(0, 10);
    return comments.filter((c) => c.post_date >= cut && (channel === 'All' || c.platform.startsWith(channel)));
  }, [comments, channel, now]);
  const replyCount = scoped.filter(needsReply).length;
  const counts = new Map<Theme, number>();
  scoped.forEach((c) => counts.set(c.theme, (counts.get(c.theme) ?? 0) + 1));

  let rows = theme === 'All' ? scoped : scoped.filter((c) => c.theme === theme);
  if (q) rows = rows.filter((c) => c.text.toLowerCase().includes(q.toLowerCase()));
  rows = rankComments(rows, rank, now);
  const maxHeat = Math.max(1, ...rows.slice(0, 50).map((c) => heat(c, now)));
  const [spot, ...rest] = rows;
  const unsupported = channel !== 'All' && channel !== 'Instagram' && channel !== 'TikTok';

  return (
    <section className="band" id="comments">
      <div className="inner">
        <div className="band-head">
          <div>
            <span className="eyebrow">Instagram UK &amp; IE and TikTok · last 14 days · {int(scoped.length)} comments</span>
            <h2>What people are saying</h2>
          </div>
          <div className="seg" role="group" aria-label="Rank comments by">
            {RANKS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={rank === k} onClick={() => { setRank(k); setLimit(18); }}>
                {l}{k === 'reply' && <span className="count">{replyCount}</span>}
              </button>
            ))}
          </div>
        </div>
        <p className="note">Hottest blends likes, replies and urgency, and fades over a week. Needs a reply is questions and pushback with no reply yet (TikTok does not report replies, so check before answering). Themes come from keyword rules: read the comment before acting on the tag.</p>

        <div className="controls">
          <div className="seg" role="group" aria-label="Theme">
            {(['All', ...THEMES] as (Theme | 'All')[]).filter((t) => t === 'All' || counts.get(t)).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => { setTheme(t); setLimit(18); }}>
                {t}<span className="count">{t === 'All' ? scoped.length : counts.get(t)}</span>
              </button>
            ))}
          </div>
          <input type="search" placeholder="Search comments" aria-label="Search comments" value={q} onChange={(e) => { setQ(e.target.value); setLimit(18); }} />
        </div>

        {unsupported ? <p className="empty">Comments are read from Instagram and TikTok only.</p> : !spot ? <p className="empty">No comments match these filters.</p> : (
          <>
            <figure className="spotlight rise" style={{ margin: 0 }}>
              <span className="eyebrow" style={{ color: 'rgba(0,0,0,.6)' }}>{rank === 'reply' ? 'Answer this first' : rank === 'newest' ? 'Latest' : 'Loudest right now'}</span>
              <blockquote className="q" style={{ margin: '8px 0 0' }}>“{spot.text}”</blockquote>
              <figcaption className="meta">
                <span className="likes">{int(spot.likes)}</span><span>likes</span>
                <span className="tag" data-t={spot.theme}>{spot.theme}</span>
                {needsReply(spot) && <span className="tag reply">Needs a reply</span>}
                <span>{spot.platform}{spot.author ? ` · @${spot.author}` : ''}</span>
                <span>{spot.commented_at ? ago(spot.commented_at) : `post of ${day(spot.post_date)}`}</span>
                {safeHref(spot.post_link) && <a href={safeHref(spot.post_link)} target="_blank" rel="noopener noreferrer">Open post</a>}
              </figcaption>
            </figure>
            <div className="cgrid">
              {rest.slice(0, limit).map((c) => {
                const nr = needsReply(c);
                const href = safeHref(c.post_link);
                const cap = caption.get(c.post_key);
                return (
                  <div key={c.comment_id} className={`cmt ${nr ? 'needs' : ''}`}>
                    <div className="heatbar" aria-hidden="true"><i style={{ width: `${Math.max(4, (heat(c, now) / maxHeat) * 100)}%` }} /></div>
                    <div className="text">{c.text}</div>
                    <div className="meta">
                      <span className="likes-n">{int(c.likes)}</span><span>likes</span>
                      <span className="tag" data-t={c.theme}>{c.theme}</span>
                      {nr && <span className="tag reply">Reply</span>}
                    </div>
                    <div className="meta"><span>{c.platform}{c.author ? ` · @${c.author}` : ''}</span><span>{c.commented_at ? ago(c.commented_at) : `post of ${day(c.post_date)}`}</span>{c.replies ? <span>{c.replies} replies</span> : null}</div>
                    {(cap || href) && <div className="on">{href ? <a href={href} target="_blank" rel="noopener noreferrer">On: {cap?.replace(/\s+/g, ' ') || 'the post'}</a> : <>On: {cap?.replace(/\s+/g, ' ')}</>}</div>}
                  </div>
                );
              })}
            </div>
            {rest.length > limit && <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setLimit((l) => l + 18)}>Show more ({rest.length - limit} left)</button>}
          </>
        )}
      </div>
    </section>
  );
}
