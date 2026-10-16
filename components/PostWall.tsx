'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChannelFilter } from '@/lib/metrics';
import { engagementRateOf, shareMultiple, sortMedia, rankComments, type PostSort } from '@/lib/social';
import type { Comment, Media } from '@/lib/types';
import { CHANNEL_COLOUR, compact, day, int, pct, safeHref } from './format';

const SORTS: [PostSort, string][] = [['shares', 'Most shared'], ['saves', 'Most saved'], ['views', 'Most viewed'], ['engagement', 'Engagement rate'], ['follows', 'New followers'], ['newest', 'Newest']];

function Thumb({ m }: { m: Media }) {
  const [broken, setBroken] = useState(false);
  if (!m.thumb_url || broken) return <div className="fallback" aria-hidden="true">{m.caption.slice(0, 90) || m.kind}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={m.thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

export default function PostWall({ media, comments, from, channel }: { media: Media[]; comments: Comment[]; from: string; channel: ChannelFilter }) {
  const [sort, setSort] = useState<PostSort>('shares');
  const [limit, setLimit] = useState(12);
  const [open, setOpen] = useState<Media | null>(null);

  const scoped = useMemo(() => media.filter((m) => m.posted >= from && (channel === 'All' || m.platform.startsWith(channel))), [media, from, channel]);
  const rows = useMemo(() => sortMedia(scoped, sort), [scoped, sort]);
  const statFor = (m: Media): [string, string, boolean][] => {
    const rate = engagementRateOf(m);
    return [
      [compact(m.shares), 'Shares', sort === 'shares'],
      [compact(m.saves), 'Saves', sort === 'saves'],
      sort === 'engagement' ? [pct(rate, 1), 'Eng. rate', true] : sort === 'follows' ? [compact(m.new_followers), 'Follows', true] : [compact(m.views), 'Views', sort === 'views'],
    ];
  };

  const unsupported = channel !== 'All' && channel !== 'Instagram' && channel !== 'TikTok';

  return (
    <section className="band" id="posts">
      <div className="inner">
        <div className="band-head">
          <div>
            <span className="eyebrow">Instagram UK &amp; IE and TikTok · tap to play</span>
            <h2>What landed</h2>
          </div>
          <div className="seg" role="group" aria-label="Rank posts by">
            {SORTS.map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => { setSort(k); setLimit(12); }}>{l}</button>)}
          </div>
        </div>
        {unsupported ? (
          <p className="empty">Post media comes from Instagram and TikTok. {channel} posts are in the full post list further down.</p>
        ) : rows.length === 0 ? (
          <p className="empty">No Instagram or TikTok posts in this period yet. Press Sync now if you have just posted.</p>
        ) : (
          <>
            <div className="wall">
              {rows.slice(0, limit).map((m, i) => {
                const mult = shareMultiple(m, media);
                const rate = engagementRateOf(m);
                const boosted = (m.views ?? 0) > 500000 && rate != null && rate < 0.005;
                return (
                  <button key={m.id} type="button" className="tile" onClick={() => setOpen(m)} aria-label={`Open ${m.platform} ${m.kind.toLowerCase()} from ${day(m.posted)}`}>
                    <Thumb m={m} />
                    <span className="shade" />
                    <span className="top">
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        <span className="plat"><i style={{ background: CHANNEL_COLOUR[m.platform] }} />{m.platform}</span>
                        {mult != null && mult >= 2 && <span className="badge">{mult.toFixed(1)}× usual shares</span>}
                        {boosted && <span className="badge boost">Likely boosted</span>}
                      </span>
                      <span className="rank">{i + 1}</span>
                    </span>
                    {(m.kind === 'Reel' || m.kind === 'Video') && <span className="play" aria-hidden="true" />}
                    <span className="bottom">
                      <span className="cap-line">{m.caption || `${m.kind} · ${day(m.posted)}`}</span>
                      <span className="stats">
                        {statFor(m).map(([v, l, hot]) => <span key={l} className={`stat ${hot ? 'hot' : ''}`}><b>{v}</b><span>{l}</span></span>)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {rows.length > limit && <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setLimit((l) => l + 12)}>Show {Math.min(12, rows.length - limit)} more of {rows.length - limit}</button>}
          </>
        )}
      </div>
      {open && <PostModal m={open} comments={comments} onClose={() => setOpen(null)} />}
    </section>
  );
}

function PostModal({ m, comments, onClose }: { m: Media; comments: Comment[]; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);

  const top = rankComments(comments.filter((c) => c.post_key === m.comment_key), 'liked').slice(0, 8);
  const rate = engagementRateOf(m);
  const stats: [string, string][] = [
    [compact(m.views), 'Views'], [compact(m.reach), 'Reach'], [compact(m.likes), 'Likes'], [compact(m.comments), 'Comments'],
    [compact(m.shares), 'Shares'], [compact(m.saves), 'Saves'],
    ...(m.reposts != null ? [[compact(m.reposts), 'Reposts'] as [string, string]] : []),
    [pct(rate, 1), 'Eng. rate'],
    ...(m.full_watch_rate != null ? [[pct(m.full_watch_rate, 0), 'Watched to end'] as [string, string]] : []),
    ...(m.avg_watch_s != null ? [[`${m.avg_watch_s.toFixed(1)}s`, 'Avg watch'] as [string, string]] : []),
    ...(m.new_followers != null ? [[int(m.new_followers), 'New followers'] as [string, string]] : []),
  ];
  const href = safeHref(m.permalink);
  const isVideo = m.kind === 'Reel' || m.kind === 'Video';

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${m.platform} post from ${day(m.posted)}`}>
        <div className="player">
          {m.platform === 'TikTok' && m.embed_url ? (
            <iframe src={m.embed_url} title="TikTok player" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
          ) : isVideo && m.media_url && !videoFailed ? (
            <video src={m.media_url} poster={m.thumb_url ?? undefined} controls autoPlay playsInline loop onError={() => setVideoFailed(true)} />
          ) : m.thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.thumb_url} alt={m.caption.slice(0, 120)} referrerPolicy="no-referrer" />
          ) : (
            <div className="fallback" style={{ position: 'absolute', inset: 0, padding: 24 }}>{m.caption || 'No preview'}</div>
          )}
        </div>
        <div className="body">
          <button ref={closeRef} type="button" className="chip close" onClick={onClose}>Close ✕</button>
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="plat"><i style={{ background: CHANNEL_COLOUR[m.platform] }} />{m.platform} · {m.kind}</span>
            <span className="muted" style={{ fontSize: '.85rem' }}>{new Date(m.posted_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })}</span>
          </div>
          {m.caption && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.caption}</p>}
          <div className="statgrid">{stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
          {videoFailed && <p className="note">This Instagram video link has expired. It refreshes on the next sync, or open it on Instagram.</p>}
          {href && <a className="chip primary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }} href={href} target="_blank" rel="noopener noreferrer">Open on {m.platform.replace(' IE', '')}</a>}
          <div>
            <span className="eyebrow">Top comments</span>
            {top.length === 0 ? <p className="note">No comments captured for this post yet. Comments are read for posts from the last 14 days.</p> : (
              <div className="cgrid" style={{ marginTop: 8 }}>
                {top.map((c) => (
                  <div key={c.comment_id} className="cmt">
                    <div className="text">{c.text}</div>
                    <div className="meta"><span className="likes-n">{int(c.likes)}</span> likes <span className="tag" data-t={c.theme}>{c.theme}</span>{c.author && <span>@{c.author}</span>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
