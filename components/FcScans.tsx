'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { FC_LAUNCH, isInstore, linkSummary, type FcLinkDay, type FcStore } from '@/lib/flavourClub';
import CountUp from './CountUp';
import { linkCol } from './FcTraffic';
import { day, int, pct } from './format';
import type { MapPoint } from './ScanMap';

const ScanMap = dynamic(() => import('./ScanMap'), { ssr: false, loading: () => <div className="scanmap" aria-busy="true" /> });
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
type Period = 'all' | 'launch' | '14d';

/** QR scans in store: which placement works, a leaderboard of stores, and a map. */
export default function FcScans({ rows, stores }: { rows: FcLinkDay[]; stores: FcStore[] }) {
  const [period, setPeriod] = useState<Period>('all');
  const [mode, setMode] = useState<'heat' | 'dots'>('heat');
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const latest = rows.reduce<string | null>((m, r) => (!m || r.day > m ? r.day : m), null);
  const from = period === 'all' ? '2000-01-01' : period === 'launch' ? FC_LAUNCH : shift(latest ?? FC_LAUNCH, -13);
  const s = useMemo(() => linkSummary(rows, from), [rows, from]);

  const placements = s.channels.filter((c) => isInstore(c.channel) && (c.total > 0 || ['Table tents', 'A-boards', 'Receipts'].includes(c.channel)));
  const storeCount = Math.max(1, stores.length);
  const byCode = new Map(s.stores.map((x, i) => [x.code ?? x.store, { ...x, rank: i + 1 }]));
  const ranked = s.stores.map((x, i) => ({ ...x, rank: i + 1 }));
  const cold = stores.filter((st) => !byCode.get(st.code)?.total).map((st) => st.name).sort();
  const max = Math.max(1, ...ranked.map((x) => x.total));
  const ttTotal = s.channels.find((c) => c.channel === 'Table tents')?.total ?? 0;
  const median = ranked.length ? ranked[Math.floor(ranked.length / 2)].total : 0;

  const points: MapPoint[] = useMemo(() => stores.filter((st) => st.lat != null && st.lng != null).map((st) => {
    const r = byCode.get(st.code);
    return { code: st.code, name: st.name, place: st.place, lat: st.lat as number, lng: st.lng as number, total: r?.total ?? 0, latest: r?.latest ?? 0, rank: r?.rank ?? null };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stores, s]);
  const onSelect = useCallback((code: string) => setSelected((c) => (c === code ? null : code)), []);
  const unplaced = stores.length - points.length;
  const testSweep = period === 'all' && rows.filter((r) => r.day === '2026-09-22' && r.total === 1).length > 40;

  return (
    <section className="band" id="scans">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">QR codes in store · Bitly{latest ? ` · up to ${day(latest)}` : ''}</span><h2>Scans</h2></div>
          <div className="seg" role="group" aria-label="Period">
            {([['all', 'All time'], ['launch', 'Since launch'], ['14d', 'Last 14 days']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
          </div>
        </div>

        <div className="small4">
          {placements.map((c, i) => (
            <div key={c.channel} className={`mini ${i === 0 ? 'hot' : ''}`}>
              <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: linkCol(c.channel), display: 'inline-block' }} />{c.channel}</span>
              <div className="value"><CountUp value={c.total} format={(n) => int(Math.round(n))} /></div>
              <div className="meta muted">{pct(c.total / Math.max(1, s.instore), 0)} of in-store scans · {(c.total / storeCount).toFixed(1)} per store</div>
            </div>
          ))}
        </div>
        <p className="note">Every placement runs estate-wide, so &ldquo;per store&rdquo; uses the same {stores.length} stores for each: a fair like-for-like. Any new QR label (a digital screen, say) appears here on its own once its link carries a <code>utm_source</code>.</p>

        <div className="scans-grid">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Table tents on the map</h3>
              <div className="seg" role="group" aria-label="Map style">
                <button type="button" aria-pressed={mode === 'heat'} onClick={() => setMode('heat')}>Heat</button>
                <button type="button" aria-pressed={mode === 'dots'} onClick={() => setMode('dots')}>Stores</button>
              </div>
            </div>
            <ScanMap points={points} selected={selected} onSelect={onSelect} mode={mode} />
            <p className="note" style={{ padding: '8px 16px 12px', margin: 0 }}>Hover a store for its numbers; click to pick it in the leaderboard. Stores sit at their area, not their exact address.{unplaced > 0 ? ` ${unplaced} not placed yet.` : ''}</p>
          </div>

          <div className="card">
            <h3>Leaderboard</h3>
            {ranked.length === 0 ? <p className="empty">No table tent scans in this period.</p> : (<>
              <div className="podium">
                {ranked.slice(0, 3).map((x) => (
                  <button key={x.code ?? x.store} type="button" className={`podium-card p${x.rank}`} aria-pressed={selected === x.code} onClick={() => x.code && onSelect(x.code)}>
                    <span className="podium-rank">{x.rank === 1 ? '1st' : x.rank === 2 ? '2nd' : '3rd'}</span>
                    <span className="podium-name">{x.store}</span>
                    <span className="podium-n">{int(x.total)}</span>
                    <span className="muted" style={{ fontSize: '.75rem' }}>{pct(x.total / Math.max(1, ttTotal), 0)} of all table tent scans{median ? ` · ${(x.total / median).toFixed(0)}× the middle store` : ''}</span>
                  </button>
                ))}
              </div>
              <ol className="board">
                {(showAll ? ranked : ranked.slice(3, 15)).filter((x) => showAll || x.rank > 3).map((x) => (
                  <li key={x.code ?? x.store}>
                    <button type="button" aria-pressed={selected === x.code} onClick={() => x.code && onSelect(x.code)}>
                      <span className="r">{x.rank}</span>
                      <span className="n">{x.store}</span>
                      <span className="bar"><i style={{ width: `${(x.total / max) * 100}%` }} /></span>
                      <span className="v">{int(x.total)}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {ranked.length > 15 && <button type="button" className="chip" onClick={() => setShowAll((v) => !v)} style={{ marginTop: 8 }}>{showAll ? 'Top 15' : `All ${ranked.length} stores`}</button>}
            </>)}
            {cold.length > 0 && <p className="note" style={{ marginTop: 12 }}><b>No scans {period === 'all' ? 'yet' : 'in this period'}:</b> {cold.join(', ')}. Worth a call to check the tents are out.</p>}
          </div>
        </div>
        {testSweep && <p className="note">22 Sep shows one scan on almost every store&apos;s tent: it looks like a test sweep, so treat a store sitting at 1 as zero.</p>}
      </div>
    </section>
  );
}
