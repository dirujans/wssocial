'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { CompetitorData } from '@/lib/data';
import { brandOf, scoreboard, type BrandScore } from '@/lib/competitors';
import type { CompetitorItem, CompetitorPost } from '@/lib/types';
import CountUp from './CountUp';
import SyncButton from './SyncButton';
import { compact, day, int, safeHref, signedInt } from './format';

type Win = 7 | 30 | 60;
type Sort = 'multiple' | 'engagement' | 'per1k' | 'newest';
const SORTS: [Sort, string][] = [['multiple', 'Vs their usual'], ['engagement', 'Most engagement'], ['per1k', 'Per 1k followers'], ['newest', 'Newest']];
const BUZZ = new Set(['buzz', 'mention', 'viral', 'ugc', 'press']);

/** Loose key so "KFC UK" (from the brief) and "KFC UK&I" (Instagram) land on the same brand chip. */
const keyOf = (brand: string) => brand.toLowerCase().replace(/^@/, '').replace(/[^a-z]/g, ' ').trim().split(/\s+/)[0] ?? '';
const shift = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function Thumb({ p }: { p: CompetitorPost }) {
  const [broken, setBroken] = useState(false);
  if (!p.thumb_url || broken) return <div className="fallback" aria-hidden="true">{(p.caption ?? '').slice(0, 90) || p.kind}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.thumb_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

export default function Competitors({ data, today }: { data: CompetitorData; today: string }) {
  const [win, setWin] = useState<Win>(30);
  const [brand, setBrand] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('multiple');
  const [limit, setLimit] = useState(18);
  const [open, setOpen] = useState<CompetitorPost | null>(null);
  const [showUs, setShowUs] = useState(true);

  const board = useMemo(() => scoreboard(data.posts, data.accounts, today), [data.posts, data.accounts, today]);
  const from = shift(today, -win);
  const chips = useMemo(() => {
    const m = new Map<string, string>();
    board.forEach((b) => m.set(keyOf(b.brand), b.brand));
    data.items.forEach((i) => { const k = keyOf(i.brand); if (!m.has(k)) m.set(k, i.brand); });
    return [...m];
  }, [board, data.items]);

  const inBrand = (name: string) => brand === 'all' || keyOf(name) === brand;
  const posts = useMemo(() => {
    const rows = data.posts.filter((p) => (p.posted ?? '') >= from && inBrand(p.brand) && (showUs || !brandOf(p.handle).us));
    const val = (p: CompetitorPost) => sort === 'multiple' ? p.multiple ?? 0 : sort === 'engagement' ? p.engagement ?? 0 : sort === 'per1k' ? p.per_1k ?? 0 : Date.parse(p.posted_at ?? '') || 0;
    return rows.sort((a, b) => val(b) - val(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.posts, from, brand, sort, showUs]);

  const rivals = data.posts.filter((p) => !brandOf(p.handle).us);
  const viral = rivals.filter((p) => p.viral && (p.posted ?? '') >= from);
  const biggest = [...rivals].filter((p) => (p.posted ?? '') >= from).sort((a, b) => (b.multiple ?? 0) - (a.multiple ?? 0))[0];
  const rivalHandles = board.filter((b) => !b.us).length;
  const moves = data.items.filter((i) => !BUZZ.has((i.kind ?? '').toLowerCase()) && inBrand(i.brand) && (i.posted_on ?? '') >= from);
  const buzz = data.items.filter((i) => BUZZ.has((i.kind ?? '').toLowerCase()) && inBrand(i.brand));
  const canes = data.items.filter((i) => keyOf(i.brand) === 'raising');
  const canesBoard = board.find((b) => b.handle === 'raisingcanes');
  const canesPosts = data.posts.filter((p) => p.handle === 'raisingcanes').sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)).slice(0, 6);

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span>
            <Link href="/" className="chip" style={{ textDecoration: 'none' }}>← Our channels</Link>
          </div>
          <h1>Competitor watch</h1>
          <p className="take">
            {rivalHandles === 0
              ? <>No competitor accounts are syncing yet. Add their Instagram handles to Windsor&apos;s Instagram Public connector and they appear after the next sync.</>
              : <>{viral.length ? <><b>{viral.length}</b> posts broke out </> : <>Nothing broke out </>}across {rivalHandles} competitor accounts in the last {win} days.
                {biggest && biggest.multiple ? <> Biggest jump: <b>{biggest.brand}</b> at <b>{biggest.multiple.toFixed(1)}×</b> their usual post.</> : null}</>}
          </p>
          {data.lastSync && <p className="cap" style={{ color: 'rgba(255,255,255,.75)' }}>Last sync {new Date(data.lastSync.finished_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} · public Instagram via Windsor.ai, moves and buzz from the morning briefs</p>}
        </div>
      </header>

      <nav className="filters" aria-label="Filters">
        <div className="inner">
          <div className="seg" role="group" aria-label="Period">
            {([7, 30, 60] as Win[]).map((w) => <button key={w} type="button" aria-pressed={win === w} onClick={() => setWin(w)}>{w} days</button>)}
          </div>
          <div className="seg" role="group" aria-label="Brand">
            <button type="button" aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>All</button>
            {chips.map(([k, name]) => <button key={k} type="button" aria-pressed={brand === k} onClick={() => setBrand((b) => (b === k ? 'all' : k))}>{name}</button>)}
          </div>
          <span style={{ marginLeft: 'auto' }}><SyncButton /></span>
        </div>
      </nav>

      <section className="band" aria-label="Headline numbers">
        <div className="inner">
          <div className="small4">
            <div className="mini rise d1"><span className="eyebrow">Accounts tracked</span><div className="value"><CountUp value={rivalHandles} format={(n) => int(n)} /></div><div className="meta muted">plus Wingstop UK as the benchmark</div></div>
            <div className="mini rise d2"><span className="eyebrow">Breakout posts · {win}d</span><div className="value"><CountUp value={viral.length} format={(n) => int(n)} /></div><div className="meta muted">2.5× or more that account&apos;s usual post</div></div>
            <div className="mini rise d3"><span className="eyebrow">Moves logged · {win}d</span><div className="value"><CountUp value={data.items.filter((i) => !BUZZ.has((i.kind ?? '').toLowerCase()) && (i.posted_on ?? '') >= from).length} format={(n) => int(n)} /></div><div className="meta muted">launches, drops, campaigns, openings</div></div>
            <div className="mini rise d4"><span className="eyebrow">Raising Cane&apos;s UK</span><div className="value" style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)' }}>Late 2026</div><div className="meta muted">Piccadilly flagship, no date confirmed</div></div>
          </div>
        </div>
      </section>

      <Scoreboard board={board.filter((b) => inBrand(b.brand))} onOpen={setOpen} />

      <section className="band" id="viral">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">Public Instagram · last {win} days · tap to play</span><h2>What&apos;s breaking out</h2></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="seg" role="group" aria-label="Rank posts by">
                {SORTS.map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => { setSort(k); setLimit(18); }}>{l}</button>)}
              </div>
              <button type="button" className="chip" aria-pressed={showUs} onClick={() => setShowUs((v) => !v)}>{showUs ? 'Hide' : 'Show'} Wingstop</button>
            </div>
          </div>
          <p className="note">“Vs their usual” compares each post with the median post on the same account, so a smaller account&apos;s breakout counts as much as a giant&apos;s. Instagram doesn&apos;t share other accounts&apos; views or shares, so this is likes plus comments.</p>
          {posts.length === 0 ? <p className="empty">No posts for this filter yet.</p> : (
            <>
              <div className="wall">
                {posts.slice(0, limit).map((p, i) => {
                  const info = brandOf(p.handle);
                  return (
                    <button key={p.id} type="button" className="tile" onClick={() => setOpen(p)} aria-label={`Open ${p.brand} ${p.kind ?? 'post'} from ${day(p.posted)}`}>
                      <Thumb p={p} />
                      <span className="shade" />
                      <span className="top">
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                          <span className="plat"><i style={{ background: info.colour }} />{p.brand}</span>
                          {p.viral && <span className="badge">{p.multiple!.toFixed(1)}× their usual</span>}
                        </span>
                        <span className="rank">{i + 1}</span>
                      </span>
                      {(p.kind === 'Reel' || p.kind === 'Video') && <span className="play" aria-hidden="true" />}
                      <span className="bottom">
                        <span className="cap-line">{p.caption || `${p.kind} · ${day(p.posted)}`}</span>
                        <span className="stats">
                          <span className={`stat ${sort === 'engagement' ? 'hot' : ''}`}><b>{compact(p.likes)}</b><span>Likes</span></span>
                          <span className="stat"><b>{compact(p.comments)}</b><span>Comments</span></span>
                          <span className={`stat ${sort === 'multiple' || sort === 'per1k' ? 'hot' : ''}`}>{sort === 'per1k' ? <><b>{p.per_1k?.toFixed(1) ?? '—'}</b><span>Per 1k</span></> : <><b>{p.multiple ? `${p.multiple.toFixed(1)}×` : '—'}</b><span>Vs usual</span></>}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {posts.length > limit && <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setLimit((l) => l + 18)}>Show {Math.min(18, posts.length - limit)} more of {posts.length - limit}</button>}
            </>
          )}
        </div>
      </section>

      <section className="band" id="canes">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Arriving in London · tracked daily</span><h2>Raising Cane&apos;s</h2></div></div>
          <div className="grid2">
            <div className="spotlight">
              <span className="eyebrow" style={{ color: 'rgba(0,0,0,.7)' }}>Where it stands</span>
              <div className="q" style={{ marginTop: 8 }}>21–22 Coventry St, Piccadilly. Late 2026.</div>
              <ul style={{ margin: '14px 0 0', paddingLeft: 18, fontWeight: 600, fontSize: '.92rem', display: 'grid', gap: 6 }}>
                <li>First UK and European site, in the old Angus Steakhouse. Branding went up in June; still no opening date.</li>
                <li>Pipeline named: The Strand, Oxford Circus, Paddington, South Bank, then drive-thrus across Greater London.</li>
                <li>Arrives with a fanbase already built online: fake &ldquo;it&apos;s open in London&rdquo; TikToks have pulled six-figure likes.</li>
              </ul>
              <div className="meta">
                {canesBoard ? <><span className="likes">{compact(canesBoard.followers)}</span><span>Instagram followers{canesBoard.followersChange7 != null ? ` · ${signedInt(canesBoard.followersChange7)} this week` : ''}</span></> : <span>Add @raisingcanes in Windsor to track their posts here.</span>}
              </div>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3>Watch for</h3>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, fontSize: '.9rem' }}>
                <li>An opening date or a UK Instagram or TikTok handle going live</li>
                <li>Hiring ads and crew-training content (usually 6 to 10 weeks before opening)</li>
                <li>Creator previews and invite-only soft launches</li>
                <li>Queue and camp-out content on opening week</li>
              </ol>
              <p className="note" style={{ marginTop: 'auto' }}>The morning brief checks these every day and logs anything new below.</p>
            </div>
          </div>
          {canesPosts.length > 0 && (
            <div className="wall" style={{ marginTop: 14 }}>
              {canesPosts.map((p) => (
                <button key={p.id} type="button" className="tile" onClick={() => setOpen(p)} aria-label={`Open Raising Cane's post from ${day(p.posted)}`}>
                  <Thumb p={p} /><span className="shade" />
                  {(p.kind === 'Reel' || p.kind === 'Video') && <span className="play" aria-hidden="true" />}
                  <span className="bottom"><span className="cap-line">{p.caption}</span><span className="stats"><span className="stat"><b>{compact(p.likes)}</b><span>Likes</span></span><span className="stat"><b>{compact(p.comments)}</b><span>Comments</span></span><span className="stat hot"><b>{p.multiple ? `${p.multiple.toFixed(1)}×` : '—'}</b><span>Vs usual</span></span></span></span>
                </button>
              ))}
            </div>
          )}
          <Feed items={canes} empty="Nothing logged on Raising Cane's yet." />
        </div>
      </section>

      <section className="band" id="moves">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Launches, drops, campaigns, openings · last {win} days</span><h2>Moves</h2></div></div>
          <Feed items={moves} empty="No moves logged for this filter. The morning brief adds to this daily." />
        </div>
      </section>

      <section className="band" id="buzz">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">What people are saying about them · viral fan content, press, chatter</span><h2>Buzz</h2></div></div>
          <Feed items={buzz} empty="No buzz logged for this filter yet." />
        </div>
      </section>

      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Internal. Competitor posts are public Instagram data through Windsor.ai (Instagram Public connector); add or remove handles there. Moves and buzz come from the daily briefs, which search news, trade press and public social. Figures appear only where a source states them.</p></div>
      </footer>

      {open && <PostModal p={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Scoreboard({ board, onOpen }: { board: BrandScore[]; onOpen: (p: CompetitorPost) => void }) {
  const maxPer = Math.max(1, ...board.map((b) => b.medianPer1k ?? 0));
  return (
    <section className="band" id="scoreboard">
      <div className="inner">
        <div className="band-head"><div><span className="eyebrow">Instagram · last 30 days</span><h2>Scoreboard</h2></div></div>
        {board.length === 0 ? <p className="empty">No accounts syncing yet.</p> : (
          <div className="card tablewrap" style={{ marginTop: 0 }}>
            <table>
              <thead><tr><th>Account</th><th className="r">Followers</th><th className="r">7-day change</th><th className="r">Posts this wk</th><th className="r">Last wk</th><th className="r">Avg per post</th><th>Engagement per 1k followers</th><th className="r">Breakouts</th><th>Best post</th></tr></thead>
              <tbody>
                {board.map((b) => (
                  <tr key={b.handle} style={b.us ? { background: 'rgba(0,167,138,.10)' } : undefined}>
                    <td><span className="sw" style={{ background: b.colour }} /><b>{b.brand}</b> <span className="muted">@{b.handle}</span></td>
                    <td className="r">{compact(b.followers)}</td>
                    <td className={`r ${b.followersChange7 == null ? '' : b.followersChange7 >= 0 ? 'up' : 'down'}`}>{b.followersChange7 == null ? <span className="muted">building</span> : signedInt(b.followersChange7)}</td>
                    <td className="r">{b.postsThisWeek}</td>
                    <td className="r muted">{b.postsLastWeek}</td>
                    <td className="r">{compact(b.avgEngagement)}</td>
                    <td style={{ minWidth: 160 }}><span className="bar" style={{ width: `${((b.medianPer1k ?? 0) / maxPer) * 110}px`, background: b.us ? 'var(--opal)' : 'var(--fg)' }} />{b.medianPer1k?.toFixed(1) ?? '—'}</td>
                    <td className="r">{b.viral30 || <span className="muted">0</span>}</td>
                    <td>{b.top ? <button type="button" className="chip" onClick={() => onOpen(b.top!)}>{compact(b.top.engagement)} · {day(b.top.posted)}</button> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note" style={{ padding: '8px 10px 0' }}>Follower change fills in as daily snapshots build up (one week after a handle is added). Engagement per 1k followers is the median post, the fairest read across accounts of different sizes.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Feed({ items, empty }: { items: CompetitorItem[]; empty: string }) {
  const rows = items.slice().sort((a, b) => Number(!!b.spike) - Number(!!a.spike) || String(b.posted_on).localeCompare(String(a.posted_on)));
  if (rows.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="feed" style={{ marginTop: 14 }}>
      {rows.map((c) => {
        const href = safeHref(c.url);
        return (
          <article key={c.id} className="item" data-p={c.spike ? 'high' : 'none'}>
            <div className="row" style={{ alignItems: 'center' }}>
              <span className="brand">{c.brand}</span>
              <span style={{ display: 'flex', gap: 6 }}>{c.spike && <span className="act spike">Spiking</span>}{c.kind && <span className="act kind">{c.kind}</span>}</span>
            </div>
            <div className="title">{c.title}</div>
            {c.summary && <div className="sum">{c.summary}</div>}
            {c.metric && <div className="muted" style={{ fontSize: '.82rem' }}>{c.metric}</div>}
            {c.so_what && <div className="why">So what: {c.so_what}</div>}
            <div className="foot"><span>{c.platform} · {day(c.posted_on)}</span>{href && <a href={href} target="_blank" rel="noopener noreferrer">Source</a>}</div>
          </article>
        );
      })}
    </div>
  );
}

function PostModal({ p, onClose }: { p: CompetitorPost; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  const isVideo = p.kind === 'Reel' || p.kind === 'Video';
  const href = safeHref(p.permalink);
  const stats: [string, string][] = [[compact(p.likes), 'Likes'], [compact(p.comments), 'Comments'], [p.multiple ? `${p.multiple.toFixed(1)}×` : '—', 'Vs their usual'], [p.per_1k?.toFixed(1) ?? '—', 'Per 1k followers']];
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${p.brand} post from ${day(p.posted)}`}>
        <div className="player">
          {isVideo && p.media_url && !failed ? (
            <video src={p.media_url} poster={p.thumb_url ?? undefined} controls autoPlay playsInline loop onError={() => setFailed(true)} />
          ) : p.thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumb_url} alt={(p.caption ?? '').slice(0, 120)} referrerPolicy="no-referrer" />
          ) : <div className="fallback" style={{ position: 'absolute', inset: 0, padding: 24 }}>{p.caption || 'No preview'}</div>}
        </div>
        <div className="body">
          <button ref={closeRef} type="button" className="chip close" onClick={onClose}>Close ✕</button>
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="plat"><i style={{ background: brandOf(p.handle).colour }} />{p.brand} · {p.kind}</span>
            <span className="muted" style={{ fontSize: '.85rem' }}>{p.posted_at ? new Date(p.posted_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }) : ''}</span>
          </div>
          {p.viral && <span className="badge" style={{ alignSelf: 'flex-start' }}>Breakout: {p.multiple!.toFixed(1)}× their usual post</span>}
          {p.caption && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.caption}</p>}
          <div className="statgrid">{stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
          {failed && <p className="note">This video link has expired. It refreshes on the next sync, or open it on Instagram.</p>}
          {href && <a className="chip primary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }} href={href} target="_blank" rel="noopener noreferrer">Open on Instagram</a>}
        </div>
      </div>
    </div>
  );
}
