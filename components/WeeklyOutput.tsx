'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { standoutStories, weeklyHistory, weeklyOutput } from '@/lib/social';
import type { Post } from '@/lib/types';
import { CHANNEL_COLOUR, compact, day, safeHref } from './format';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyOutput({ posts, today }: { posts: Post[]; today: string }) {
  const { rows, thisWeekFrom, daysIn } = weeklyOutput(posts, today);
  const hist = weeklyHistory(posts, today, 8);
  const channels = rows.map((r) => r.channel);
  const { picks, median } = standoutStories(posts, today);
  const total = rows.reduce((s, r) => s + r.thisWeek, 0), totalLast = rows.reduce((s, r) => s + r.lastWeekSameDays, 0);
  const stories = rows.reduce((s, r) => s + r.stories, 0), storiesLast = rows.reduce((s, r) => s + r.storiesLastWeek, 0);
  const diff = (a: number, b: number) => (a === b ? 'level' : a > b ? `+${a - b}` : `−${b - a}`);

  return (
    <section className="band" id="output">
      <div className="inner">
        <div className="band-head">
          <div>
            <span className="eyebrow">Week of {day(thisWeekFrom)} · {daysIn} of 7 days in ({DAYS[daysIn - 1]})</span>
            <h2>What we put out</h2>
          </div>
          <p className="note">Feed posts and videos this week so far against the same days last week. Stories are counted separately. From Sprout, all channels.</p>
        </div>

        <div className="wk">
          <div className="c" style={{ background: 'var(--fg)', color: '#000' }}>
            <span className="eyebrow" style={{ color: 'rgba(0,0,0,.65)' }}>All channels</span>
            <div className="n">{total}</div>
            <div className="vs" style={{ color: 'rgba(0,0,0,.7)' }}>{diff(total, totalLast)} vs {totalLast} by {DAYS[daysIn - 1]} last week</div>
          </div>
          {rows.map((r) => (
            <div key={r.channel} className="c">
              <span className="eyebrow"><span className="sw" style={{ background: CHANNEL_COLOUR[r.channel] }} />{r.channel}</span>
              <div className="n">{r.thisWeek}</div>
              <div className={`vs ${r.thisWeek > r.lastWeekSameDays ? 'up' : r.thisWeek < r.lastWeekSameDays ? 'down' : ''}`}>{diff(r.thisWeek, r.lastWeekSameDays)} vs same days last week</div>
              <div className="vs">Last week {r.lastWeek} · week before {r.weekBefore}</div>
            </div>
          ))}
          <div className="c">
            <span className="eyebrow">IG stories</span>
            <div className="n">{stories}</div>
            <div className="vs">{storiesLast} across all of last week</div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <h3>Posts per week</h3>
            <p className="note">Last 8 weeks, feed and video, by channel.</p>
            <div style={{ width: '100%', height: 240, marginTop: 10 }}>
              <ResponsiveContainer>
                <BarChart data={hist} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="week" tickFormatter={(w: string) => day(w)} tick={{ fill: 'var(--muted)', fontSize: 11 }} stroke="var(--line)" interval={0} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} stroke="var(--line)" />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,.05)' }} content={({ active, label, payload }) => active && payload?.length ? (
                    <div className="tip"><div className="muted">Week of {day(String(label))}</div>{payload.map((p) => <div key={String(p.dataKey)}><span className="sw" style={{ background: String(p.color) }} />{String(p.dataKey)} {String(p.value)}</div>)}</div>
                  ) : null} />
                  {channels.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={CHANNEL_COLOUR[c]} radius={i === channels.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Stories doing well</h3>
            <p className="note">Instagram stories from the last 7 days{median ? `, against a typical story of ${compact(median)} impressions` : ''}. Starred stories ran at 1.5× typical or better.</p>
            {picks.length === 0 ? <p className="empty">No stories in the last 7 days.</p> : (
              <div className="storyrow" style={{ marginTop: 12 }}>
                {picks.slice(0, 8).map(({ post, multiple }) => {
                  const star = multiple != null && multiple >= 1.5;
                  const href = safeHref(post.link);
                  return (
                    <a key={post.post_guid} className={`story ${star ? 'star' : ''}`} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <span className="eyebrow">{day(post.posted)}{star ? ' · ★' : ''}</span>
                      <span className="n">{compact(post.impressions)}</span>
                      <span className="muted" style={{ fontSize: '.78rem' }}>impressions{multiple != null ? ` · ${multiple.toFixed(1)}× typical` : ''}</span>
                      <span style={{ fontSize: '.8rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{post.text || 'No caption'}</span>
                      <span className="muted" style={{ fontSize: '.74rem', marginTop: 'auto' }}>{post.comments ?? 0} replies · {post.shares} shares</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
