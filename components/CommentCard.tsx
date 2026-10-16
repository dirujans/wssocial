import type { Comment } from '@/lib/types';
import { ago, day, safeHref } from './format';

export default function CommentCard({ c, postText }: { c: Comment; postText?: string }) {
  const href = safeHref(c.post_link);
  return (
    <div className="cmt">
      <div className="cmt-text">{c.text}</div>
      <div className="meta">
        <span className="tag" data-t={c.theme}>{c.theme}</span>
        <span>{c.likes.toLocaleString('en-GB')} {c.likes === 1 ? 'like' : 'likes'}</span>
        <span>{c.platform}{c.author ? ` · @${c.author}` : ''}</span>
        <span>{c.commented_at ? ago(c.commented_at) : `post of ${day(c.post_date)}`}</span>
      </div>
      {postText !== undefined && (
        <div className="on">{href ? <a href={href} target="_blank" rel="noopener noreferrer">On: {postText || 'a post'}</a> : <>On: {postText || 'a post'}</>}</div>
      )}
    </div>
  );
}
