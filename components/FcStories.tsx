'use client';

import type { IgStory } from '@/lib/windsor';
import { compact, int, pct } from './format';

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : 'Unknown time');

/**
 * Our own Instagram Stories since launch. Stories carry no caption in the API, so the team marks any that weren't about the club
 * ("Not club") and the totals leave them out.
 */
export default function FcStories({ stories, marks, onMark }: { stories: IgStory[]; marks: Record<string, string>; onMark: (key: string, verdict: string) => void }) {
  const club = stories.filter((s) => marks[`story:${s.id}`] !== 'skip');
  const sum = (k: keyof Pick<IgStory, 'views' | 'reach' | 'replies' | 'shares' | 'interactions'>) => club.reduce((a, s) => a + (s[k] ?? 0), 0);
  const views = sum('views');
  const left = club.reduce((a, s) => a + (s.exits ?? 0) + (s.swipe_forward ?? 0), 0);
  return (
    <section className="band" id="stories">
      <div className="inner">
        <div className="band-head"><div><span className="eyebrow">Our Instagram Stories since launch · captured four times a day before Instagram drops the stats at 24 hours</span><h2>Our Stories</h2></div></div>
        <div className="small4">
          <div className="mini"><span className="eyebrow">Stories</span><div className="value">{int(club.length)}</div><div className="meta muted">{stories.length - club.length ? `${stories.length - club.length} marked not club` : 'all counted as club'}</div></div>
          <div className="mini"><span className="eyebrow">Views</span><div className="value">{compact(views)}</div><div className="meta muted">{club.length ? `${compact(Math.round(views / club.length))} a Story` : 'none yet'}</div></div>
          <div className="mini"><span className="eyebrow">Replies and shares</span><div className="value">{int(sum('replies') + sum('shares'))}</div><div className="meta muted">{int(sum('replies'))} replies, {int(sum('shares'))} shares</div></div>
          <div className="mini"><span className="eyebrow">Dropped off</span><div className="value">{views ? pct(left / views, 0) : 'n/a'}</div><div className="meta muted">of views left or swiped away</div></div>
        </div>
        {stories.length === 0 ? <p className="empty">No Stories captured yet. The first capture runs at the next sync; anything posted before 21 Oct had already expired.</p> : (
          <div className="story-row">
            {stories.map((s) => {
              const skip = marks[`story:${s.id}`] === 'skip';
              const drop = s.views ? ((s.exits ?? 0) + (s.swipe_forward ?? 0)) / s.views : null;
              return (
                <article key={s.id} className="story-card" style={{ opacity: skip ? 0.45 : 1 }}>
                  <a className="story-thumb" href={s.permalink ?? undefined} target="_blank" rel="noopener noreferrer" aria-label="Open the Story">
                    {s.thumb_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.thumb_url} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : null}
                    <span className="story-when">{time(s.posted_at)}{s.platform === 'Instagram IE' ? ' · IE' : ''}</span>
                  </a>
                  <div className="story-stats">
                    <span><b>{compact(s.views)}</b> views</span>
                    <span><b>{compact(s.reach)}</b> reach</span>
                    <span><b>{int(s.replies)}</b> replies</span>
                    <span><b>{int(s.shares)}</b> shares</span>
                    {drop != null && <span><b>{pct(drop, 0)}</b> dropped</span>}
                  </div>
                  <button type="button" className={`chip ${skip ? '' : 'primary'}`} onClick={() => onMark(`story:${s.id}`, skip ? 'clear' : 'skip')}>{skip ? 'Count as club' : '✓ Club story'}</button>
                </article>
              );
            })}
          </div>
        )}
        <p className="note" style={{ marginTop: 12 }}>Instagram&apos;s API gives no caption or sticker detail for Stories, so mark any that weren&apos;t about the club. Thumbnails come from Instagram and can expire after a few days. Other people&apos;s Stories mentioning us only reach our inbox as messages; no tool here can read them.</p>
      </div>
    </section>
  );
}
