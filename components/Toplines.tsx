'use client';

import type { Headline } from '@/lib/metrics';
import type { Topline } from '@/lib/social';
import CountUp from './CountUp';
import Sparkline from './Sparkline';
import { compact, day, pct, signedInt, signedPct, signedPts } from './format';

const LABEL: Record<string, string> = { shares: 'Shares', saves: 'Saves', reposts: 'Reposts', views: 'Views', follows: 'New follows' };
const WHY: Record<string, string> = {
  shares: 'People sending us to their group chat. The clearest sign content travels.',
  saves: 'People keeping it to come back to. Intent, not just a scroll.',
  reposts: 'People putting it on their own profile. The highest form of endorsement.',
};

const SPLIT_NOTE: Record<string, Partial<Record<'organic' | 'paid' | 'combined', string>>> = {
  shares: { organic: 'Instagram account shares are organic already; TikTok Spark Ad shares taken out.', paid: 'Shares on the ads themselves: Instagram ads and TikTok Spark Ads.', combined: 'Organic plus shares on Instagram ads.' },
  saves: { organic: 'TikTok video saves include any Spark Ad saves: TikTok does not split them.', paid: 'Saves on Instagram ads. TikTok does not report saves for ads.', combined: 'Organic plus saves on Instagram ads.' },
  reposts: { paid: 'No platform reports reposts from ads.' },
};

function Delta({ v, pts }: { v: number | null | undefined; pts?: boolean }) {
  if (v == null) return <span className="delta">New</span>;
  return <span className={`delta ${v >= 0 ? 'up' : 'down'}`}>{v >= 0 ? '▲' : '▼'} {(pts ? signedPts(v) : signedPct(v)).replace(/^[+−]/, '')}</span>;
}

export default function Toplines({ social, from, to, period, heads, scopeNote, split = 'combined', igK = null }: {
  social: Topline[] | null; from: string | null; to: string | null; period: number; heads: Headline[]; scopeNote: string | null; split?: 'organic' | 'paid' | 'combined'; igK?: number | null;
}) {
  const splitLabel = split === 'organic' ? 'organic' : split === 'paid' ? 'paid' : 'organic + paid';
  const t = (m: string) => social?.find((x) => x.metric === m);
  const h = (m: string) => heads.find((x) => x.metric === m);
  const big = ['shares', 'saves', 'reposts'];
  return (
    <section className="band" id="toplines" aria-label="Headline numbers">
      <div className="inner">
        <div className="band-head">
          <div>
            <span className="eyebrow">{from && to ? `${day(from)} to ${day(to)} · vs the ${period} days before` : `Last ${period} days`}</span>
            <h2>Did it travel?</h2>
          </div>
          {scopeNote && <p className="note">{scopeNote}</p>}
        </div>

        {social ? (
          <div className="big3">
            {big.map((m, i) => {
              const x = t(m);
              return (
                <article key={m} className={`big-card rise d${i + 1} ${i === 0 ? 'lead' : ''}`}>
                  <div className="row" style={{ alignItems: 'center' }}>
                    <span className="label">{LABEL[m]} <span style={{ opacity: .6, fontWeight: 500 }}>· {splitLabel}</span></span>
                    <Delta v={x?.change} />
                  </div>
                  <div className="value"><CountUp value={x?.current} format={(n) => compact(Math.round(n))} /></div>
                  <div className="meta">
                    <span className={i === 0 ? '' : 'muted'}>vs {compact(x?.previous)} before</span>
                    <span className="split">{x?.byPlatform.map((p) => <span key={p.platform}>{p.platform} {compact(p.value)}</span>)}</span>
                  </div>
                  <p className="why-note">{WHY[m]}{x?.note ? ` ${x.note}.` : ''}{SPLIT_NOTE[m]?.[split] ? ` ${SPLIT_NOTE[m][split]}` : ''}</p>
                  <div className="spark"><Sparkline values={x?.series.map((s) => s.value) ?? []} colour={i === 0 ? '#000' : 'var(--opal)'} /></div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty">Shares, saves and reposts come from Instagram and TikTok directly. Pick All, Instagram or TikTok to see them.</p>
        )}

        <div className="small4">
          <div className="mini rise">
            <span className="eyebrow">Views · IG + TikTok · {splitLabel}</span>
            <div className="value">{social ? <CountUp value={t('views')?.current} format={(n) => compact(Math.round(n))} /> : '—'}</div>
            <div className="meta">{social && <Delta v={t('views')?.change} />}</div>
            <p className="why-note" style={{ marginTop: 6 }}>{split === 'combined' ? 'Everything, including ads.' : `TikTok Spark plays${igK != null ? ' and Instagram ad views' : ''} ${split === 'organic' ? 'taken out' : 'only'}.`}{split !== 'combined' && igK != null ? ` Instagram ads add about ${igK.toFixed(2)} account views per impression, learnt from our history.` : ''}</p>
          </div>
          <div className="mini rise d1">
            <span className="eyebrow">New follows · IG + TikTok · {splitLabel}</span>
            <div className="value">{social ? <CountUp value={t('follows')?.current} format={(n) => signedInt(Math.round(n))} /> : '—'}</div>
            <div className="meta">{social && <Delta v={t('follows')?.change} />}</div>
            {split !== 'combined' && <p className="why-note" style={{ marginTop: 6 }}>TikTok paid follows from the ad account. Instagram can&apos;t be split: Meta doesn&apos;t report follows from ads.</p>}
          </div>
          <div className="mini rise d2">
            <span className="eyebrow">Engagement rate · all channels</span>
            <div className="value"><CountUp value={h('engagement_rate')?.current != null ? (h('engagement_rate')!.current as number) * 100 : null} format={(n) => n.toFixed(2) + '%'} /></div>
            <div className="meta"><Delta v={h('engagement_rate')?.change} pts /> <span className="muted">vs {pct(h('engagement_rate')?.previous, 2)}</span></div>
          </div>
          <div className="mini rise d3">
            <span className="eyebrow">Impressions · all channels</span>
            <div className="value"><CountUp value={h('impressions')?.current} format={(n) => compact(Math.round(n))} /></div>
            <div className="meta"><Delta v={h('impressions')?.change} /> <span className="muted">Sprout</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
