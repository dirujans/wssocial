'use client';

import { useMemo, useState } from 'react';
import { FC_LAUNCH, INSTORE_CHANNELS, linkSummary, type FcLinkDay, type LinkChannel } from '@/lib/flavourClub';
import CountUp from './CountUp';
import { day, int, pct } from './format';

export const LINK_COL: Record<LinkChannel, string> = {
  TikTok: 'var(--s1)', Instagram: 'var(--s2)', 'Table tents': 'var(--opal)', 'A-boards': 'var(--lemon)', Receipts: 'var(--mango)', Other: 'var(--line-2)',
};
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/** Bitly clicks and QR scans heading to flavourclub.co.uk: social links head to head, in-store QR codes, and every store's table tent. */
export default function FcTraffic({ rows }: { rows: FcLinkDay[] }) {
  const [period, setPeriod] = useState<'launch' | '14d'>('launch');
  const [allStores, setAllStores] = useState(false);
  const latest = rows.reduce<string | null>((m, r) => (!m || r.day > m ? r.day : m), null);
  const from = period === 'launch' ? FC_LAUNCH : shift(latest ?? FC_LAUNCH, -13);
  const s = useMemo(() => linkSummary(rows, from), [rows, from]);
  const trend = useMemo(() => linkSummary(rows, shift(latest ?? FC_LAUNCH, -13)).days, [rows, latest]);
  const c = (k: LinkChannel) => s.channels.find((x) => x.channel === k) ?? { channel: k, total: 0, latest: 0 };
  const tt = c('TikTok'), ig = c('Instagram');
  const socialMax = Math.max(1, tt.total + ig.total);
  const dayMax = Math.max(1, ...trend.map((d) => d.total));
  const stores = allStores ? s.stores : s.stores.slice(0, 12);
  const storeMax = Math.max(1, ...s.stores.map((x) => x.total));

  return (
    <section className="band" id="traffic">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">Bitly clicks and QR scans to flavourclub.co.uk{latest ? ` · up to ${day(latest)}` : ''}</span><h2>Sign-up traffic</h2></div>
          <div className="seg" role="group" aria-label="Period">
            <button type="button" aria-pressed={period === 'launch'} onClick={() => setPeriod('launch')}>Since launch</button>
            <button type="button" aria-pressed={period === '14d'} onClick={() => setPeriod('14d')}>Last 14 days</button>
          </div>
        </div>
        {rows.length === 0 ? <p className="empty">No Bitly data yet. The 07:20 refresh fills this in.</p> : (<>
          <div className="big3">
            <article className="big-card lead rise d1">
              <span className="label">Social links · TikTok vs Instagram</span>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
                {[tt, ig].map((x) => (
                  <div key={x.channel}>
                    <div className="value" style={{ color: LINK_COL[x.channel] }}><CountUp value={x.total} format={(n) => int(Math.round(n))} /></div>
                    <div className="meta"><span>{x.channel}</span><span className="muted">{pct(x.total / socialMax, 0)}</span></div>
                  </div>
                ))}
              </div>
              <span className="track" style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--chip)', marginTop: 12 }} aria-hidden>
                <span style={{ width: `${(tt.total / socialMax) * 100}%`, background: LINK_COL.TikTok }} /><span style={{ width: `${(ig.total / socialMax) * 100}%`, background: LINK_COL.Instagram }} />
              </span>
              <p className="why-note">bit.ly/flavourc-tt and bit.ly/flavourc-ig, plus the untagged Instagram homepage link. Clicks, not sign-ups.</p>
            </article>
            <article className="big-card rise d2">
              <span className="label">In store · QR scans</span>
              <div className="value"><CountUp value={s.instore} format={(n) => int(Math.round(n))} /></div>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {INSTORE_CHANNELS.map((k) => (
                  <div key={k} className="hbar"><span className="lbl">{k}</span><span className="track"><span style={{ width: `${Math.max(0.5, (c(k).total / Math.max(1, s.instore)) * 100)}%`, background: LINK_COL[k] }} /></span><span className="val">{int(c(k).total)}</span></div>
                ))}
              </div>
            </article>
            <article className="big-card rise d3">
              <span className="label">In store vs social</span>
              <div className="value">{s.social ? `${(s.instore / s.social).toFixed(1)}×` : '—'}</div>
              <p className="why-note">For every click from a social link, this many scans came from a table tent, A-board or receipt. {s.stores.length} table tents have been scanned at least once in this period.</p>
            </article>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Every day, last 14 days</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 180, marginTop: 14 }} role="img" aria-label="Daily clicks and scans by channel">
              {trend.map((d) => (
                <div key={d.day} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', height: '100%', justifyContent: 'flex-end' }} title={`${day(d.day)}: ${int(d.total)}`}>
                  <span style={{ fontSize: '.68rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} className="muted">{d.total >= dayMax * 0.25 ? int(d.total) : ''}</span>
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', height: `${(d.total / dayMax) * 82}%`, minHeight: 2, borderRadius: 4, overflow: 'hidden' }}>
                    {(Object.keys(LINK_COL) as LinkChannel[]).map((k) => d.byChannel[k] ? <span key={k} style={{ flex: d.byChannel[k], background: LINK_COL[k] }} /> : null)}
                  </div>
                  <span style={{ fontSize: '.66rem', textAlign: 'center', marginTop: 4, fontWeight: d.day === FC_LAUNCH ? 800 : 400 }}>{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: '.78rem' }}>
              {(Object.keys(LINK_COL) as LinkChannel[]).filter((k) => trend.some((d) => d.byChannel[k])).map((k) => <span key={k} className="plat"><i style={{ background: LINK_COL[k] }} />{k}</span>)}
            </div>
          </div>

          <div className="card tablewrap" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h3>Table tents by store</h3>
              {s.stores.length > 12 && <button type="button" className="chip" onClick={() => setAllStores((v) => !v)}>{allStores ? 'Top 12' : `All ${s.stores.length}`}</button>}
            </div>
            {s.stores.length === 0 ? <p className="empty">No table tent scans in this period.</p> : (
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>#</th><th>Store</th><th className="r">Scans</th><th className="r">{latest ? day(latest) : 'Latest day'}</th><th style={{ width: '35%' }} /></tr></thead>
                <tbody>
                  {stores.map((x, i) => (
                    <tr key={x.code ?? x.store}>
                      <td className="muted">{i + 1}</td>
                      <td><b>{x.store}</b>{x.code && <span className="muted" style={{ fontSize: '.75rem' }}> · {x.code}</span>}</td>
                      <td className="r">{int(x.total)}</td>
                      <td className="r">{int(x.latest)}</td>
                      <td><span className="track" style={{ display: 'flex', height: 8, borderRadius: 4, background: 'var(--chip)', overflow: 'hidden' }}><span style={{ width: `${(x.total / storeMax) * 100}%`, background: LINK_COL['Table tents'] }} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="note" style={{ marginTop: 10 }}>Bitly counts taps and scans, and days are UTC. It can&apos;t tell us who finished signing up: that needs the sign-up event from Google Analytics or the Flavour Club platform. Stores whose QR code got no scans at all don&apos;t appear in the table.</p>
        </>)}
      </div>
    </section>
  );
}
