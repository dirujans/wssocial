'use client';

import { useMemo, useState } from 'react';
import type { ChannelFilter } from '@/lib/metrics';
import { THEMES, type Comment, type Post, type Theme } from '@/lib/types';
import CommentCard from './CommentCard';

export default function CommentsPanel({ comments, posts, channel }: { comments: Comment[]; posts: Post[]; channel: ChannelFilter }) {
  const [theme, setTheme] = useState<Theme | 'All'>('All');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'likes' | 'newest'>('likes');
  const [limit, setLimit] = useState(24);
  const postText = useMemo(() => new Map(posts.map((p) => [p.comment_key, p.text.replace(/\s+/g, ' ')])), [posts]);

  const scoped = channel === 'All' ? comments : comments.filter((c) => c.platform.startsWith(channel));
  const counts = new Map<Theme, number>();
  scoped.forEach((c) => counts.set(c.theme, (counts.get(c.theme) ?? 0) + 1));
  let rows = theme === 'All' ? scoped : scoped.filter((c) => c.theme === theme);
  if (q) rows = rows.filter((c) => c.text.toLowerCase().includes(q.toLowerCase()));
  rows = rows.slice().sort((a, b) => (sort === 'likes' ? b.likes - a.likes : String(b.commented_at ?? b.post_date).localeCompare(String(a.commented_at ?? a.post_date))));

  return (
    <section className="card" id="comments">
      <div className="row">
        <div>
          <h2>What people are saying</h2>
          <p className="note">Comments on Wingstop UK and Ireland Instagram and Wingstop UK TikTok, last 14 days. Themes come from keyword rules, so read the comment before acting on its tag. Instagram hides commenters&apos; names.</p>
        </div>
        <select aria-label="Sort comments" value={sort} onChange={(e) => setSort(e.target.value as 'likes' | 'newest')}>
          <option value="likes">Most liked</option>
          <option value="newest">Newest</option>
        </select>
      </div>
      <div className="controls">
        <div className="seg" role="group" aria-label="Theme">
          {(['All', ...THEMES] as (Theme | 'All')[]).filter((t) => t === 'All' || counts.get(t)).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => { setTheme(t); setLimit(24); }}>
              {t}<span className="count">{t === 'All' ? scoped.length : counts.get(t)}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search comments" aria-label="Search comments" value={q} onChange={(e) => { setQ(e.target.value); setLimit(24); }} />
      </div>
      {rows.length === 0 ? (
        <p className="empty">{channel !== 'All' && channel !== 'Instagram' && channel !== 'TikTok' ? 'Comments are read for Instagram and TikTok only.' : 'No comments match these filters.'}</p>
      ) : (
        <div className="comments">{rows.slice(0, limit).map((c) => <CommentCard key={c.comment_id} c={c} postText={postText.get(c.post_key) ?? ''} />)}</div>
      )}
      {rows.length > limit && <button type="button" className="chip" style={{ marginTop: 10 }} onClick={() => setLimit((l) => l + 24)}>Show more ({rows.length - limit} left)</button>}
    </section>
  );
}
