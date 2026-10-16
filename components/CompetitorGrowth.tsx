'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { brandOf, growthSeries, type BrandScore, type GrowthMetric } from '@/lib/competitors';
import type { CompetitorAccountDay, CompetitorItem, CompetitorPost } from '@/lib/types';
import { compact, day, safeHref } from './format';

// Chart lines need to be told apart, and most chicken brands are red, so lines use flavour accents in order.
// Wingstop always takes Opal so "us" is constant across every view.
const LINE = ['#ff7470', '#ffcf00', '#00b5b9', '#ff7500', '#92cb2d', '#dec282', '#c58bd9', '#ffffff', '#8a9190', '#fa0009'];

const METRICS: [GrowthMetric, string, string][] = [
  ['per1k', 'Engagement per 1k followers', 'Average likes plus comments per post, per 1,000 followers. The fairest read across accounts of different sizes.'],
  ['engagement', 'Total engagement', 'All likes plus comments on posts that went up that week.'],
  ['avg', 'Avg per post', 'Average likes plus comments per post that week.'],
  ['posts', 'Posts per week', 'Feed posts and reels published that week.'],
  ['followers', 'Followers', 'Daily follower snapshots. Instagram only gives today’s count, so this line starts the day an account was added and grows from there.'],
];

const fmt = (m: GrowthMetric, v: number) => (m === 'per1k' ? v.toFixed(1) : m === 'posts' ? String(Math.round(v)) : compact(Math.round(v)));

export function GrowthPanel({ posts, accounts, board, today }: { posts: CompetitorPost[]; accounts: CompetitorAccountDay[]; board: BrandScore[]; today: string }) {
  const [metric, setMetric] = useState<GrowthMetric>('per1k');
  const handles = board.map((b) => b.handle);
  const colours = useMemo(() => {
    const m: Record<string, string> = {}; let i = 0;
    handles.forEach((h) => { m[h] = brandOf(h).us ? 'var(--opal)' : LINE[i++ % LINE.length]; });
    return m;
  }, [handles.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const shown = handles.filter((h) => !hidden.has(h));
  const rows = useMemo(() => growthSeries(posts, accounts, handles, metric, today), [posts, accounts, handles.join('|'), metric, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (h: string) => setHidden((s) => { const n = new Set(s); if (n.has(h)) n.delete(h); else n.add(h); return n; });
  const info = METRICS.find((m) => m[0] === metric)!;
  const followerDays = new Set(accounts.map((a) => a.date)).size;

  return (
    <section className="band" id="growth">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">Instagram · {metric === 'followers' ? 'daily' : 'weekly, last 120 days'}</span><h2>Growth over time</h2></div>
          <div className="seg" role="group" aria-label="Measure">
            {METRICS.map(([k, l]) => <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)}>{l}</button>)}
          </div>
        </div>
        <p className="note">{info[2]} Instagram doesn&apos;t share other accounts&apos; views, shares or saves, so competitor engagement is likes plus comments. Our own shares, saves and reposts are on the main dashboard.</p>
        <div className="seg" role="group" aria-label="Accounts on the chart" style={{ marginTop: 10 }}>
          {handles.map((h) => (
            <button key={h} type="button" aria-pressed={!hidden.has(h)} onClick={() => toggle(h)} onDoubleClick={() => setHidden(new Set(handles.filter((x) => x !== h)))} title="Click to hide or show. Double-click to show only this one.">
              <span className="sw" style={{ background: colours[h] }} />{brandOf(h).brand}
            </button>
          ))}
        </div>
        {metric === 'followers' && followerDays < 2 ? (
          <p className="empty">Follower history starts today ({followerDays} snapshot so far). Each sync adds a day, so the line draws from tomorrow and a 7-day change appears in a week. Current counts are in the scoreboard above.</p>
        ) : rows.length === 0 ? <p className="empty">No posts synced yet.</p> : (
          <div style={{ width: '100%', height: 360, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(d: string) => day(d)} minTickGap={36} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" />
                <YAxis tickFormatter={(v: number) => fmt(metric, v)} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" width={56} />
                <Tooltip content={({ active, label, payload }) => active && payload?.length ? (
                  <div className="tip">
                    <div className="muted">{metric === 'followers' ? day(String(label)) : `Week of ${day(String(label))}`}{payload[0].payload.partial ? ' (so far)' : ''}</div>
                    {payload.filter((p) => p.value != null).sort((a, b) => Number(b.value) - Number(a.value)).map((p) => (
                      <div key={String(p.dataKey)}><span className="sw" style={{ background: String(p.color) }} />{brandOf(String(p.dataKey)).brand} {fmt(metric, Number(p.value))}</div>
                    ))}
                  </div>) : null} />
                {shown.map((h) => (
                  <Line key={h} type="monotone" dataKey={h} stroke={colours[h]} strokeWidth={brandOf(h).us ? 3.5 : 2} dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {metric !== 'followers' && <p className="cap">The latest week is still in progress, so it will read low until Sunday.</p>}
      </div>
    </section>
  );
}

const KINDS: [string, string][] = [['all', 'All'], ['product', 'Product'], ['innovation', 'Innovation'], ['opening', 'Openings'], ['campaign', 'Campaigns'], ['collab', 'Collabs'], ['deal', 'Deals'], ['people', 'People']];
const GROUP: Record<string, string> = { drop: 'product', launch: 'product', product: 'product', innovation: 'innovation', opening: 'opening', expansion: 'opening', campaign: 'campaign', stunt: 'campaign', collab: 'collab', deal: 'deal', people: 'people', backlash: 'campaign' };
const keyOf = (brand: string) => brand.toLowerCase().replace(/^@/, '').replace(/[^a-z]/g, ' ').trim().split(/\s+/)[0] ?? '';

/** Announcements grouped by brand: newest first, filterable by type. Buzz lives in its own section. */
export function BrandFile({ items, board, inBrand }: { items: CompetitorItem[]; board: BrandScore[]; inBrand: (b: string) => boolean }) {
  const [kind, setKind] = useState('all');
  const announcements = items.filter((i) => GROUP[(i.kind ?? '').toLowerCase()] && inBrand(i.brand) && (kind === 'all' || GROUP[(i.kind ?? '').toLowerCase()] === kind));
  const brands = new Map<string, CompetitorItem[]>();
  announcements.sort((a, b) => String(b.posted_on).localeCompare(String(a.posted_on))).forEach((i) => {
    const k = keyOf(i.brand); brands.set(k, [...(brands.get(k) ?? []), i]);
  });
  const ordered = [...brands].sort((a, b) => String(b[1][0].posted_on).localeCompare(String(a[1][0].posted_on)));
  const counts = (k: string) => items.filter((i) => GROUP[(i.kind ?? '').toLowerCase()] && inBrand(i.brand) && (k === 'all' || GROUP[(i.kind ?? '').toLowerCase()] === k)).length;

  return (
    <section className="band" id="announcements">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">Product, innovation, openings and more · per brand · newest first</span><h2>Announcements</h2></div>
          <div className="seg" role="group" aria-label="Type">
            {KINDS.map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}<span className="count">{counts(k)}</span></button>)}
          </div>
        </div>
        {ordered.length === 0 ? <p className="empty">Nothing logged for this filter. The morning report adds to this daily.</p> : (
          <div className="feed" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 24rem), 1fr))' }}>
            {ordered.map(([k, list]) => {
              const b = board.find((x) => keyOf(x.brand) === k);
              return (
                <article key={k} className="item" style={{ borderLeftColor: b?.colour ?? 'var(--line-2)' }}>
                  <div className="row" style={{ alignItems: 'baseline' }}>
                    <span className="title" style={{ fontSize: '1.35rem', fontStyle: 'italic', fontWeight: 900, fontStretch: '62%' }}>{list[0].brand}</span>
                    <span className="muted" style={{ fontSize: '.8rem' }}>{b?.followers ? `${compact(b.followers)} on IG · ` : ''}{list.length} {list.length === 1 ? 'announcement' : 'announcements'}</span>
                  </div>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
                    {list.slice(0, 6).map((c) => {
                      const href = safeHref(c.url);
                      return (
                        <li key={c.id} style={{ display: 'grid', gap: 4, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="act kind">{GROUP[(c.kind ?? '').toLowerCase()] ?? c.kind}</span>
                            {c.spike && <span className="act spike">Spiking</span>}
                            <span className="muted" style={{ fontSize: '.78rem' }}>{day(c.posted_on)}</span>
                          </div>
                          <div style={{ fontWeight: 800 }}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{c.title}</a> : c.title}</div>
                          {c.summary && <div className="sum" style={{ fontSize: '.86rem' }}>{c.summary}</div>}
                          {c.metric && <div className="muted" style={{ fontSize: '.8rem' }}>{c.metric}</div>}
                          {c.so_what && <div className="why">So what: {c.so_what}</div>}
                        </li>
                      );
                    })}
                  </ol>
                  {list.length > 6 && <span className="muted" style={{ fontSize: '.8rem' }}>+{list.length - 6} older</span>}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
