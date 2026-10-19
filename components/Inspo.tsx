'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { InspoData } from '@/lib/data';
import { replyBank } from '@/lib/audience';
import { trendFit, type TikTokVideo } from '@/lib/tiktok';
import { TikTokModal } from './CompetitorTikTok';
import { CHANNEL_COLOUR, compact, day, int, pct, safeHref } from './format';

type Filter = 'ours' | 'maybe' | 'all' | 'skipped';
const FIT_LABEL = { ours: 'Our territory', maybe: 'Maybe', skip: 'Not ours' } as const;
const FIT_COL = { ours: 'var(--opal)', maybe: 'var(--lemon)', skip: 'var(--line-2)' } as const;

async function mark(key: string, verdict: string) {
  const r = await fetch('/api/inspo/mark', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, verdict }) });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.error ?? 'Could not save');
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), w = 120, h = 30;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" stroke="var(--opal-hi)" strokeWidth="2" /></svg>;
}

export default function Inspo({ data }: { data: InspoData }) {
  const [filter, setFilter] = useState<Filter>('ours');
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(data.marks.map((m) => [m.key, m.verdict])));
  const [open, setOpen] = useState<TikTokVideo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const latestDate = data.trendDates[0] ?? null, prevDate = data.trendDates[1] ?? null;
  const trends = useMemo(() => {
    const prev = new Map(data.trends.filter((t) => t.date === prevDate).map((t) => [t.hashtag, t.rank]));
    return data.trends.filter((t) => t.date === latestDate).map((t) => ({ ...t, fit: trendFit(t), prevRank: prev.get(t.hashtag) ?? null }));
  }, [data.trends, latestDate, prevDate]);
  const shown = trends.filter((t) => {
    const m = marks[`tag:${t.hashtag}`];
    if (filter === 'skipped') return m === 'skip';
    if (m === 'skip') return false;
    if (filter === 'all') return true;
    if (m === 'ours') return true;
    return t.fit === filter;
  });
  const bank = useMemo(() => replyBank(data.comments), [data.comments]);
  const aboutUs = data.mentions.filter((m) => ['creator', 'praise', 'community', 'review'].includes((m.kind ?? '').toLowerCase()) && !m.done).slice(0, 9);
  const rivals = useMemo(() => [...data.tiktok].filter((v) => v.handle !== 'wingstopuk' && (v.plays ?? 0) > 5000)
    .sort((a, b) => ((b.shares ?? 0) + (b.saves ?? 0)) / (b.plays || 1) - ((a.shares ?? 0) + (a.saves ?? 0)) / (a.plays || 1)).slice(0, 6), [data.tiktok]);
  const sounds = useMemo(() => {
    const m = new Map<string, number>();
    data.tiktok.filter((v) => v.music && !v.music_original).forEach((v) => m.set(v.music!, (m.get(v.music!) ?? 0) + (v.plays ?? 0)));
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [data.tiktok]);

  const setMark = async (key: string, verdict: string) => {
    const before = marks[key];
    setMarks((s) => { const n = { ...s }; if (verdict === 'clear') delete n[key]; else n[key] = verdict; return n; });
    try { await mark(key, verdict); } catch (e) { setErr((e as Error).message); setMarks((s) => ({ ...s, [key]: before })); }
  };

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/" className="chip" style={{ textDecoration: 'none' }}>Our channels</Link>
              <Link href="/audience" className="chip" style={{ textDecoration: 'none' }}>Our audience</Link>
              <Link href="/competitors" className="chip" style={{ textDecoration: 'none' }}>Competitor watch</Link>
              <Link href="/nso" className="chip" style={{ textDecoration: 'none' }}>NSO</Link>
            </span>
          </div>
          <h1>Inspo</h1>
          <p className="take">
            {trends.length ? <><b>{trends.filter((t) => t.fit === 'ours').length}</b> of {trends.length} UK trending hashtags this week sit in our territory. </> : <>UK trends land after the next sync. </>}
            <b>{bank.length}</b> comments worth a video reply. A filter, not a feed: &ldquo;skip&rdquo; is an answer too.
          </p>
        </div>
      </header>
      {err && <section className="band" style={{ paddingTop: 12, paddingBottom: 12 }}><div className="inner"><p className="note" role="status" style={{ color: 'var(--atomic)' }}>{err}</p></div></section>}

      <section className="band" id="trends">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">TikTok Creative Center · UK · 7 days{latestDate ? ` · as of ${day(latestDate)}` : ''}</span><h2>Trending now, filtered</h2></div>
            <div className="seg" role="group" aria-label="Filter trends">
              {([['ours', 'Ours'], ['maybe', 'Maybe'], ['all', 'All'], ['skipped', 'Skipped']] as [Filter, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
          </div>
          <p className="note">&ldquo;Our territory&rdquo; is a keyword pointer (flavour, food, music, football, students, seasonal moments), not a verdict. Mark a trend <b>Ours</b> or <b>Skip</b> and the whole team sees it. Before jumping on anything, ask whether it fits flavour, music or culture, and whether it still has days left in it: a falling line usually means you&apos;re late.</p>
          {shown.length === 0 ? <p className="empty">{trends.length ? 'Nothing in this filter. Try All.' : 'The first UK trends scrape is running; results land at the next sync.'}</p> : (
            <div className="trendgrid">
              {shown.map((t) => {
                const key = `tag:${t.hashtag}`; const m = marks[key];
                const move = t.prevRank != null && t.rank != null ? t.prevRank - t.rank : null;
                return (
                  <article key={t.hashtag} className="trend" data-fit={m === 'ours' ? 'ours' : t.fit}>
                    <div className="row" style={{ alignItems: 'center' }}>
                      <span className="rankn">{t.rank}</span>
                      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="act" style={{ background: FIT_COL[t.fit], color: t.fit === 'skip' ? 'var(--fg)' : '#000' }}>{FIT_LABEL[t.fit]}</span>
                        {t.direction && <span className={`delta ${t.direction === 'up' ? 'up' : t.direction === 'down' ? 'down' : ''}`}>{t.direction === 'up' ? '▲ rising' : t.direction === 'down' ? '▼ falling' : t.direction}</span>}
                        {move != null && move !== 0 && <span className="muted" style={{ fontSize: '.75rem' }}>{move > 0 ? `+${move}` : move} places</span>}
                      </span>
                    </div>
                    <a className="tag-name" href={safeHref(t.url)} target="_blank" rel="noopener noreferrer">#{t.hashtag}</a>
                    <div className="row" style={{ alignItems: 'flex-end' }}>
                      <span className="muted" style={{ fontSize: '.8rem' }}>{compact(t.views)} views · {compact(t.posts)} posts{t.industries.length ? ` · ${t.industries.join(', ')}` : ''}</span>
                      <Spark values={t.series.map((s) => s.value)} />
                    </div>
                    {t.top_creators.length > 0 && <div className="muted" style={{ fontSize: '.75rem' }}>Leading: {t.top_creators.slice(0, 3).map((c) => c.handle).join(', ')}</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className={`chip ${m === 'ours' ? 'primary' : ''}`} onClick={() => setMark(key, m === 'ours' ? 'clear' : 'ours')}>{m === 'ours' ? '★ Ours' : 'Ours'}</button>
                      <button type="button" className="chip" onClick={() => setMark(key, m === 'skip' ? 'clear' : 'skip')}>{m === 'skip' ? 'Unskip' : 'Skip'}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="note" style={{ marginTop: 10 }}>Trending sounds: TikTok no longer publishes its UK sounds chart to the tools we use, so there&apos;s no honest trending-audio feed. The nearest real signal is below: sounds that rivals&apos; best TikToks are using right now.</p>
          {sounds.length > 0 && (
            <div className="card" style={{ marginTop: 8 }}>
              <h3>Sounds in rivals&apos; recent TikToks</h3>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>{sounds.map(([name, plays]) => <div key={name} className="row"><span>{name}</span><span className="muted">{compact(plays)} plays</span></div>)}</div>
            </div>
          )}
        </div>
      </section>

      <section className="band" id="replies">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Under our posts · last 3 weeks · questions, the funny, requests, the loud</span><h2>Reply with a video</h2></div></div>
          <p className="note">Candidates for a reply video or a pinned reply. Complaints are left out on purpose: those get a direct reply, not a skit. Mark one <b>Used</b> once it&apos;s made so nobody doubles up.</p>
          {bank.length === 0 ? <p className="empty">No strong candidates in the last three weeks.</p> : (
            <div className="cgrid" style={{ marginTop: 10 }}>
              {bank.map(({ c, why }) => {
                const key = `comment:${c.comment_id}`; const used = marks[key] === 'used';
                return (
                  <div key={c.comment_id} className="cmt" style={{ opacity: used ? 0.45 : 1 }}>
                    <div className="text">{c.text}</div>
                    <div className="meta">
                      <span className="likes-n">{int(c.likes)}</span> likes
                      <span className="plat"><i style={{ background: CHANNEL_COLOUR[c.platform] }} />{c.platform}</span>
                      {why.map((w) => <span key={w} className="tag" data-t={w === 'Request' ? "Where's ours?" : w === 'Funny' ? 'Tagging a friend' : w === 'Wants in' ? 'Wants in' : 'Love'}>{w}</span>)}
                      {c.author && <span>@{c.author}</span>}
                      {safeHref(c.post_link) && <a href={safeHref(c.post_link)} target="_blank" rel="noopener noreferrer">Post</a>}
                      <button type="button" className={`chip ${used ? 'primary' : ''}`} onClick={() => setMark(key, used ? 'clear' : 'used')}>{used ? '✓ Used' : 'Mark used'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="about-us">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Creators and fans posting about us · last 30 days</span><h2>React, stitch, repost</h2></div></div>
          {aboutUs.length === 0 ? <p className="empty">Nothing new from creators or fans this month. The morning report adds what it finds.</p> : (
            <div className="feed">
              {aboutUs.map((m) => (
                <article key={m.id} className="item" data-p={m.priority ?? 'none'}>
                  <div className="row" style={{ alignItems: 'center' }}><span className="brand">{m.source}{m.author ? ` · ${m.author}` : ''}</span>{m.kind && <span className="act kind">{m.kind}</span>}</div>
                  <div className="title">{m.title}</div>{m.summary && <div className="sum">{m.summary}</div>}
                  {m.metric && <div className="muted" style={{ fontSize: '.82rem' }}>{m.metric}</div>}
                  <div className="foot"><span>{day(m.posted_on)}</span>{safeHref(m.url) && <a href={safeHref(m.url)} target="_blank" rel="noopener noreferrer">Open</a>}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="rivals">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Rivals&apos; TikToks · last 14 days · highest share and save rate</span><h2>What people pass on</h2></div></div>
          <p className="note">For understanding the mechanic (the hook, the format, why people sent it), never for copying.</p>
          {rivals.length === 0 ? <p className="empty">Rival TikToks land after the next sync.</p> : (
            <div className="wall">
              {rivals.map((v) => (
                <button key={v.id} type="button" className="tile" onClick={() => setOpen(v)} aria-label={`Play ${v.brand} TikTok`}>
                  {v.cover_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="fallback">{v.caption.slice(0, 90)}</div>}
                  <span className="shade" />
                  <span className="top"><span className="plat"><i style={{ background: '#fff' }} />{v.brand}</span></span>
                  <span className="play" aria-hidden="true" />
                  <span className="bottom">
                    <span className="cap-line">{v.caption}</span>
                    <span className="stats">
                      <span className="stat"><b>{compact(v.plays)}</b><span>Plays</span></span>
                      <span className="stat hot"><b>{v.plays ? pct(((v.shares ?? 0) + (v.saves ?? 0)) / v.plays, 1) : '—'}</b><span>Pass-on</span></span>
                      <span className="stat"><b>{compact(v.saves)}</b><span>Saves</span></span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Internal. UK trending hashtags from TikTok Creative Center and rival TikToks via Apify (free tier), refreshed daily and twice a week. Comments from Instagram and TikTok via Windsor.ai. Fit and reply tags are keyword rules: a pointer to look, never a brief.</p></div>
      </footer>
      {open && <TikTokModal v={open} onClose={() => setOpen(null)} />}
    </main>
  );
}
