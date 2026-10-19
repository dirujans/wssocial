'use client';

import { useMemo, useState } from 'react';
import { FC_LAUNCH, isInstore, linkSummary, type FcLinkDay, type LinkChannel } from '@/lib/flavourClub';
import CountUp from './CountUp';
import { day, int, pct } from './format';

const KNOWN: Record<string, string> = {
  TikTok: 'var(--s1)', Instagram: 'var(--s2)', 'Table tents': 'var(--opal)', 'A-boards': 'var(--lemon)', Receipts: 'var(--mango)', 'Small bags': 'var(--hawaiian)', 'Large bags': 'var(--citrus)', Other: 'var(--line-2)',
};
const SPARE = ['var(--atomic)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
/** Colour per channel; new labels get a spare colour, stable by name. */
export const linkCol = (c: LinkChannel) => KNOWN[c] ?? SPARE[[...c].reduce((h, ch) => h + ch.charCodeAt(0), 0) % SPARE.length];
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/** Bitly clicks and QR scans heading to flavourclub.co.uk: social links head to head, in-store QR codes, and every store's table tent. */
export default function FcTraffic({ rows }: { rows: FcLinkDay[] }) {
  const [period, setPeriod] = useState<'launch' | '14d'>('launch');
  const latest = rows.reduce<string | null>((m, r) => (!m || r.day > m ? r.day : m), null);
  const from = period === 'launch' ? FC_LAUNCH : shift(latest ?? FC_LAUNCH, -13);
  const s = useMemo(() => linkSummary(rows, from), [rows, from]);
  const trend = useMemo(() => linkSummary(rows, shift(latest ?? FC_LAUNCH, -13)).days, [rows, latest]);
  const c = (k: LinkChannel) => s.channels.find((x) => x.channel === k) ?? { channel: k, total: 0, latest: 0 };
  const tt = c('TikTok'), ig = c('Instagram');
  const socialMax = Math.max(1, tt.total + ig.total);
  const dayMax = Math.max(1, ...trend.map((d) => d.total));

  return (
    <section className="band" id="traffic">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">Bitly link clicks and QR scans to flavourclub.co.uk{latest ? ` · up to ${day(latest)}` : ''}</span><h2>Sign-up traffic</h2></div>
          <div className="seg" role="group" aria-label="Period">
            <button type="button" aria-pressed={period === 'launch'} onClick={() => setPeriod('launch')}>Since launch</button>
            <button type="button" aria-pressed={period === '14d'} onClick={() => setPeriod('14d')}>Last 14 days</button>
          </div>
        </div>
        {rows.length === 0 ? <p className="empty">No Bitly data yet. The 07:20 refresh fills this in.</p> : (<>
          <div className="big3">
            <article className="big-card rise d1">
              <span className="label">Social links · TikTok vs Instagram</span>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
                {[tt, ig].map((x) => (
                  <div key={x.channel}>
                    <div className="value"><CountUp value={x.total} format={(n) => int(Math.round(n))} /></div>
                    <div className="meta"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: linkCol(x.channel), display: 'inline-block' }} />{x.channel}</span><span className="muted">{pct(x.total / socialMax, 0)}</span></div>
                  </div>
                ))}
              </div>
              <span className="track" style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--chip)', marginTop: 12 }} aria-hidden>
                <span style={{ width: `${(tt.total / socialMax) * 100}%`, background: linkCol('TikTok') }} /><span style={{ width: `${(ig.total / socialMax) * 100}%`, background: linkCol('Instagram') }} />
              </span>
              <p className="why-note">bit.ly/flavourc-tt and bit.ly/flavourc-ig, plus the untagged Instagram homepage link. Clicks, not sign-ups.</p>
            </article>
            <article className="big-card rise d2">
              <span className="label">In store · QR scans</span>
              <div className="value"><CountUp value={s.instore} format={(n) => int(Math.round(n))} /></div>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {s.channels.filter((x) => isInstore(x.channel) && x.total > 0).map(({ channel: k }) => (
                  <div key={k} className="hbar"><span className="lbl">{k}</span><span className="track"><span style={{ width: `${Math.max(0.5, (c(k).total / Math.max(1, s.instore)) * 100)}%`, background: linkCol(k) }} /></span><span className="val">{int(c(k).total)}</span></div>
                ))}
              </div>
            </article>
            <article className="big-card rise d3">
              <span className="label">In store vs social</span>
              <div className="value">{s.social ? `${(s.instore / s.social).toFixed(1)}×` : '—'}</div>
              <p className="why-note">For every click from a social link, this many QR scans in store. Store by store in Scans below.</p>
            </article>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Every day, last 14 days</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 180, marginTop: 14 }} role="img" aria-label="Daily clicks and scans by channel">
              {trend.map((d) => (
                <div key={d.day} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', height: '100%', justifyContent: 'flex-end' }} title={`${day(d.day)}: ${int(d.total)}`}>
                  <span style={{ fontSize: '.68rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} className="muted">{d.total >= dayMax * 0.25 ? int(d.total) : ''}</span>
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', height: `${(d.total / dayMax) * 82}%`, minHeight: 2, borderRadius: 4, overflow: 'hidden' }}>
                    {Object.entries(d.byChannel).map(([k, n]) => n ? <span key={k} style={{ flex: n, background: linkCol(k) }} /> : null)}
                  </div>
                  <span style={{ fontSize: '.66rem', textAlign: 'center', marginTop: 4, fontWeight: d.day === FC_LAUNCH ? 800 : 400 }}>{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: '.78rem' }}>
              {[...new Set(trend.flatMap((d) => Object.keys(d.byChannel)))].map((k) => <span key={k} className="plat"><i style={{ background: linkCol(k) }} />{k}</span>)}
            </div>
          </div>

          <p className="note" style={{ marginTop: 10 }}>Bitly counts taps and scans, and days are UTC. It can&apos;t tell us who finished signing up: that needs the sign-up event from Google Analytics or the Flavour Club platform.</p>
        </>)}
      </div>
    </section>
  );
}
