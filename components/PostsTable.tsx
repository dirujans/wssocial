'use client';

import { Fragment, useMemo, useState } from 'react';
import type { ChannelFilter } from '@/lib/metrics';
import type { Comment, Post } from '@/lib/types';
import CommentCard from './CommentCard';
import { day, int, pct, safeHref } from './format';

type Kind = 'feed' | 'story' | 'all';
type SortKey = 'posted' | 'channel' | 'format' | 'views' | 'engagements' | 'engagement_rate' | 'comments';

export default function PostsTable({ posts, comments, from, channel, pickedDay, onClearDay }: {
  posts: Post[]; comments: Comment[]; from: string; channel: ChannelFilter; pickedDay: string | null; onClearDay: () => void;
}) {
  const [kind, setKind] = useState<Kind>('feed');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'views', dir: -1 });
  const [open, setOpen] = useState<string | null>(null);
  const effKind: Kind = pickedDay ? 'all' : kind;

  const rows = useMemo(() => {
    let r = posts.filter((p) => (effKind === 'all' ? true : effKind === 'story' ? p.format === 'Story' : p.format !== 'Story'));
    r = pickedDay ? r.filter((p) => p.posted === pickedDay) : r.filter((p) => p.posted >= from);
    if (channel !== 'All') r = r.filter((p) => p.channel === channel);
    if (q) r = r.filter((p) => p.text.toLowerCase().includes(q.toLowerCase()));
    const { key, dir } = sort;
    return r.slice().sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1;
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * dir;
    });
  }, [posts, effKind, pickedDay, from, channel, q, sort]);
  const maxViews = Math.max(1, ...rows.map((r) => r.views ?? 0));
  const byPost = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const c of comments) { const list = m.get(c.post_key) ?? []; list.push(c); m.set(c.post_key, list); }
    return m;
  }, [comments]);

  const Th = ({ k, label, num }: { k: SortKey; label: string; num?: boolean }) => (
    <th className={num ? 'num' : undefined} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: k === 'channel' || k === 'format' ? 1 : -1 }))}>
        {label}{sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <section className="card" id="posts">
      <h2>Posts</h2>
      <p className="note">Click a post to read its comments. Views are video views for videos, otherwise impressions. A huge view count with an engagement rate under 0.5% usually means the post was boosted.</p>
      <div className="controls">
        <div className="seg" role="group" aria-label="Format">
          {([['feed', 'Feed and video'], ['story', 'Stories'], ['all', 'All']] as [Kind, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={effKind === k} onClick={() => { setKind(k); if (pickedDay) onClearDay(); }}>{l}</button>
          ))}
        </div>
        {pickedDay && <button type="button" className="chip" onClick={onClearDay}>Posted {day(pickedDay)} ×</button>}
        <input type="search" placeholder="Search post text" aria-label="Search post text" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tablewrap tall">
        {rows.length === 0 ? <p className="empty">No posts match these filters.</p> : (
          <table>
            <thead><tr>
              <Th k="posted" label="Posted" /><Th k="channel" label="Channel" /><th className="hide-sm">Format</th><th>Post</th>
              <Th k="views" label="Views" num /><Th k="engagements" label="Engagements" num /><Th k="engagement_rate" label="Eng. rate" num /><Th k="comments" label="Comments" num />
            </tr></thead>
            <tbody>
              {rows.map((p) => {
                const isOpen = open === p.post_guid;
                const boosted = (p.views ?? 0) > 500000 && p.engagement_rate != null && p.engagement_rate < 0.005;
                const cs = byPost.get(p.comment_key) ?? [];
                const toggle = () => setOpen(isOpen ? null : p.post_guid);
                return (
                  <Fragment key={p.post_guid}>
                    <tr className="click" tabIndex={0} aria-expanded={isOpen} onClick={toggle}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
                      <td>{isOpen ? '▾ ' : '▸ '}{day(p.posted)}</td>
                      <td>{p.channel}</td>
                      <td className="hide-sm">{p.format}</td>
                      <td><div className={`clamp ${p.text ? '' : 'muted'}`}>{p.text || 'No caption'}</div></td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}><span className="bar" style={{ width: Math.max(2, ((p.views ?? 0) / maxViews) * 64) }} />{int(p.views)}</td>
                      <td className="r">{int(p.engagements)}</td>
                      <td className={`r ${boosted ? 'down' : ''}`} title={boosted ? 'Very low for this many views: likely boosted' : undefined}>{pct(p.engagement_rate)}</td>
                      <td className="r">{int(p.comments)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="detail"><td colSpan={8}>
                        {p.text && <p style={{ margin: '0 0 8px' }}>{p.text}</p>}
                        <div className="meta">
                          {safeHref(p.link) && <a className="link" href={safeHref(p.link)} target="_blank" rel="noopener noreferrer">Open on {p.channel}</a>}
                          <span>{cs.length ? 'Top comments, last 14 days' : p.channel === 'Instagram' || p.channel === 'TikTok' ? 'No comments in the last 14 days' : 'Comments are read for Instagram and TikTok only'}</span>
                        </div>
                        {cs.length > 0 && <div className="comments">{cs.slice(0, 6).map((c) => <CommentCard key={c.comment_id} c={c} />)}</div>}
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
