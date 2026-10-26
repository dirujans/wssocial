'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TikTokAccountDay, TikTokVideo } from '@/lib/tiktok';
import { compact, day, pct, safeHref } from './format';

type Sort = 'multiple' | 'shares' | 'saves' | 'plays' | 'newest';
const SORTS: [Sort, string][] = [['multiple', 'Vs their usual'], ['shares', 'Most shared'], ['saves', 'Most saved'], ['plays', 'Most played'], ['newest', 'Newest']];
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const shift = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export default function CompetitorTikTok({ videos, days, today, win }: { videos: TikTokVideo[]; days: TikTokAccountDay[]; today: string; win: number }) {
  const [sort, setSort] = useState<Sort>('multiple');
  const [open, setOpen] = useState<TikTokVideo | null>(null);
  const [limit, setLimit] = useState(12);
  const from = shift(today, -win);
  const lastPull = days.reduce<string | null>((m, d) => (!m || d.date > m ? d.date : m), null);

  const board = useMemo(() => {
    const handles = [...new Set([...days.map((d) => d.handle), ...videos.map((v) => v.handle)])];
    return handles.map((h) => {
      const vs = videos.filter((v) => v.handle === h && (v.posted ?? '') >= from);
      const latest = days.filter((d) => d.handle === h).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
      const plays = vs.reduce((s, v) => s + (v.plays ?? 0), 0);
      const shares = vs.reduce((s, v) => s + (v.shares ?? 0), 0), saves = vs.reduce((s, v) => s + (v.saves ?? 0), 0);
      return {
        handle: h, brand: vs[0]?.brand ?? latest?.brand ?? h, us: h === 'wingstopuk', fans: latest?.fans ?? null, verified: latest?.verified ?? null,
        n: vs.length, medPlays: median(vs.map((v) => v.plays ?? 0)), shares, saves,
        shareRate: plays ? shares / plays : null, saveRate: plays ? saves / plays : null, breakouts: vs.filter((v) => v.viral).length,
      };
    }).sort((a, b) => Number(b.us) - Number(a.us) || (b.saveRate ?? 0) + (b.shareRate ?? 0) - ((a.saveRate ?? 0) + (a.shareRate ?? 0)));
  }, [videos, days, from]);

  const rows = useMemo(() => {
    const val = (v: TikTokVideo) => sort === 'multiple' ? v.multiple ?? 0 : sort === 'shares' ? v.shares ?? 0 : sort === 'saves' ? v.saves ?? 0 : sort === 'plays' ? v.plays ?? 0 : Date.parse(v.posted_at ?? '') || 0;
    return videos.filter((v) => (v.posted ?? '') >= from).sort((a, b) => val(b) - val(a));
  }, [videos, from, sort]);
  const maxRate = Math.max(0.0001, ...board.map((b) => (b.shareRate ?? 0) + (b.saveRate ?? 0)));

  if (!videos.length && !days.length) {
    return (
      <section className="band" id="tiktok"><div className="inner">
        <div className="band-head"><div><span className="eyebrow">TikTok · plays, shares and saves</span><h2>TikTok</h2></div></div>
        <p className="empty">The first TikTok scrape is running. Results land at the next sync.</p>
      </div></section>
    );
  }

  return (
    <section className="band" id="tiktok">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">TikTok · last {win} days · plays, shares and saves are public here</span><h2>TikTok: what travels</h2></div>
          <div className="seg" role="group" aria-label="Rank videos by">{SORTS.map(([k, l]) => <button key={k} type="button" aria-pressed={sort === k} onClick={() => { setSort(k); setLimit(12); }}>{l}</button>)}</div>
        </div>
        <p className="note">TikTok shows every video&apos;s shares and saves publicly, so this is the one place we can compare shares and saves like for like. Share and save rate are per play. Videos refresh weekly (Apify free credit); latest 12 per account.{lastPull ? ` Last pulled ${day(lastPull)}.` : ''}</p>
        <div className="card tablewrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Account</th><th className="r">Followers</th><th className="r">Videos</th><th className="r">Median plays</th><th className="r">Shares</th><th className="r">Saves</th><th>Share + save rate</th><th className="r">Breakouts</th></tr></thead>
            <tbody>
              {board.map((b) => (
                <tr key={b.handle} style={b.us ? { background: 'rgba(0,167,138,.10)' } : undefined}>
                  <td><b>{b.brand}</b> <span className="muted">@{b.handle}{b.verified === false ? ' · unverified' : ''}</span></td>
                  <td className="r">{compact(b.fans)}</td>
                  <td className="r">{b.n}</td>
                  <td className="r">{compact(b.medPlays)}</td>
                  <td className="r">{compact(b.shares)}</td>
                  <td className="r">{compact(b.saves)}</td>
                  <td style={{ minWidth: 170 }}>
                    <span className="bar" style={{ width: `${((b.shareRate ?? 0) / maxRate) * 110}px`, background: b.us ? 'var(--opal)' : 'var(--fg)' }} />
                    <span className="bar" style={{ width: `${((b.saveRate ?? 0) / maxRate) * 110}px`, background: 'var(--lemon)', marginLeft: -6 }} />
                    {b.shareRate != null ? `${pct(b.shareRate, 1)} · ${pct(b.saveRate, 1)}` : '—'}
                  </td>
                  <td className="r">{b.breakouts || <span className="muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ padding: '8px 10px 0' }}>White bar: shares per play. Yellow bar: saves per play.</p>
        </div>
        {rows.length > 0 && (
          <>
            <div className="wall" style={{ marginTop: 14 }}>
              {rows.slice(0, limit).map((v, i) => (
                <button key={v.id} type="button" className="tile" onClick={() => setOpen(v)} aria-label={`Play ${v.brand} TikTok from ${day(v.posted)}`}>
                  {v.cover_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="fallback">{v.caption.slice(0, 90)}</div>}
                  <span className="shade" />
                  <span className="top">
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                      <span className="plat"><i style={{ background: v.handle === 'wingstopuk' ? 'var(--opal)' : '#fff' }} />{v.brand}</span>
                      {v.viral && v.multiple && <span className="badge">{v.multiple.toFixed(1)}× their usual</span>}
                    </span>
                    <span className="rank">{i + 1}</span>
                  </span>
                  <span className="play" aria-hidden="true" />
                  <span className="bottom">
                    <span className="cap-line">{v.caption || day(v.posted)}</span>
                    <span className="stats">
                      <span className={`stat ${sort === 'plays' || sort === 'multiple' ? 'hot' : ''}`}><b>{compact(v.plays)}</b><span>Plays</span></span>
                      <span className={`stat ${sort === 'shares' ? 'hot' : ''}`}><b>{compact(v.shares)}</b><span>Shares</span></span>
                      <span className={`stat ${sort === 'saves' ? 'hot' : ''}`}><b>{compact(v.saves)}</b><span>Saves</span></span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {rows.length > limit && <button type="button" className="chip" style={{ alignSelf: 'flex-start', marginTop: 10 }} onClick={() => setLimit((l) => l + 12)}>Show {Math.min(12, rows.length - limit)} more</button>}
          </>
        )}
      </div>
      {open && <TikTokModal v={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

export function TikTokModal({ v, onClose }: { v: TikTokVideo; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  const stats: [string, string][] = [[compact(v.plays), 'Plays'], [compact(v.likes), 'Likes'], [compact(v.comments), 'Comments'], [compact(v.shares), 'Shares'], [compact(v.saves), 'Saves'], [v.plays ? pct(((v.shares ?? 0) + (v.saves ?? 0)) / v.plays, 1) : '—', 'Share + save rate'], [v.multiple ? `${v.multiple.toFixed(1)}×` : '—', 'Vs their usual']];
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${v.brand} TikTok`}>
        <div className="player"><iframe src={`https://www.tiktok.com/player/v1/${v.id}`} title="TikTok player" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen /></div>
        <div className="body">
          <button ref={closeRef} type="button" className="chip close" onClick={onClose}>Close ✕</button>
          <div className="row" style={{ alignItems: 'center' }}><span className="plat"><i style={{ background: '#fff' }} />{v.brand} · TikTok</span><span className="muted" style={{ fontSize: '.85rem' }}>{v.posted_at ? new Date(v.posted_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }) : ''}</span></div>
          {v.caption && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{v.caption}</p>}
          <div className="statgrid">{stats.map(([a, b]) => <div key={b}><b>{a}</b><span>{b}</span></div>)}</div>
          {v.music && <p className="note">Sound: {v.music}{v.music_original ? ' (original)' : ''}</p>}
          {safeHref(v.url) && <a className="chip primary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }} href={safeHref(v.url)} target="_blank" rel="noopener noreferrer">Open on TikTok</a>}
        </div>
      </div>
    </div>
  );
}
