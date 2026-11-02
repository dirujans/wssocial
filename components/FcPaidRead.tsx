'use client';

import { useMemo } from 'react';
import { paidRead, type FcAdDay, type FcLinkDay, type AdsOnOff } from '@/lib/flavourClub';
import CountUp from './CountUp';
import { day, int } from './format';

const ADS = 'var(--s2)', NO_ADS = 'var(--opal)';
const nDays = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const per = (x: AdsOnOff['withAds']) => (x.median == null ? 'no days yet' : `${int(Math.round(x.median))} a day`);

/** What the social sign-up links do with club ads running and with none. Clicks only, never spend. */
export default function FcPaidRead({ rows, ads }: { rows: FcLinkDay[]; ads: FcAdDay[] }) {
  const r = useMemo(() => paidRead(rows, ads), [rows, ads]);
  if (!r.to) return null;
  const ratio = r.channels.find((c) => c.channel === 'Instagram')?.ratio;
  return (
    <section className="band" id="signup-clicks">
      <div className="inner">
        <div className="band-head">
          <div><span className="eyebrow">Bitly clicks on our social sign-up links, read against club ads · complete days to {day(r.to)}</span><h2>Sign-up clicks with and without ads</h2></div>
        </div>
        <div className="big3">
          {r.channels.map((c, i) => (
            <article key={c.channel} className={`big-card rise d${i + 1}`}>
              <span className="label">{c.channel} link · a day without ads</span>
              <div className="value">{c.withoutAds.median == null ? '—' : <CountUp value={c.withoutAds.median} format={(n) => int(Math.round(n))} />}</div>
              <div className="meta"><span>Against {per(c.withAds)} with ads</span></div>
              <p className="why-note">{nDays(c.withoutAds.days)} without ads, {nDays(c.withAds.days)} with. {int(c.total)} clicks since launch.</p>
            </article>
          ))}
          <article className="big-card rise d3">
            <span className="label">In-store QR scans · a day without ads</span>
            <div className="value">{r.instore.withoutAds.median == null ? '—' : <CountUp value={r.instore.withoutAds.median} format={(n) => int(Math.round(n))} />}</div>
            <div className="meta"><span>Against {per(r.instore.withAds)} with ads</span></div>
            <p className="why-note">No ad points at a table tent, so this is the traffic the stores bring. {nDays(r.instore.withoutAds.days)} without any club ads so far{r.instore.withoutAds.days < 7 ? ': too early to call' : ''}.</p>
          </article>
        </div>

        <div className="big3" style={{ marginTop: 14 }}>
          {r.channels.map((c) => {
            const max = Math.max(1, ...c.days.map((d) => d.clicks));
            return (
              <div key={c.channel} className="card">
                <h3>{c.channel} link, every day</h3>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 130, marginTop: 12 }} role="img" aria-label={`${c.channel} link clicks per day, with days running club ads marked`}>
                  {c.days.map((d) => (
                    <div key={d.day} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }} title={`${day(d.day)}: ${int(d.clicks)} link clicks, ${int(d.adClicks)} ad clicks`}>
                      <span style={{ display: 'block', height: `${(d.clicks / max) * 88}%`, minHeight: 2, borderRadius: 3, background: d.adClicks > 0 ? ADS : NO_ADS }} />
                      <span style={{ fontSize: '.6rem', textAlign: 'center', marginTop: 4 }} className="muted">{d.day.slice(8)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, fontSize: '.78rem' }}>
                  <span className="plat"><i style={{ background: ADS }} />Club ads running</span>
                  <span className="plat"><i style={{ background: NO_ADS }} />No club ads</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="note" style={{ marginTop: 10 }}>
          Clicks, so they stop short of telling us who finished signing up. There&apos;s no organic figure here on purpose: Bitly counts {ratio ? `about ${ratio.toFixed(1)}× what Meta counts on the same days` : 'more than the ad platforms do'}, so taking ad clicks away from link clicks would invent organic traffic that vanishes when ads stop. Days without ads are the honest read of what the links earn alone. Instagram ads on 19 to 21 Oct barely touched this link, so they must have pointed elsewhere.
        </p>
      </div>
    </section>
  );
}
