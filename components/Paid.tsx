'use client';

import { useMemo, useState } from 'react';
import type { PaidData } from '@/lib/data';
import { AGENCY_LABEL, boosts, campaigns, efficiency, igPaidModel, paidByDay, spikes, splitViews, totals, type AdDay, type Agency } from '@/lib/paid';
import CountUp from './CountUp';
import SectionNav from './SectionNav';
import { LphFooter } from './Brand';
import { compact, day, int, pct, safeHref } from './format';

type Period = 7 | 28 | 90;
type PlatformFilter = 'All' | 'Meta' | 'TikTok';
const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const gbp = (v: number | null | undefined, dp = 0) => (v == null || !Number.isFinite(v) ? 'n/a' : `£${v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`);
const gbpk = (v: number) => (v >= 10000 ? `£${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : gbp(v));
const AG_COL: Record<Agency, string> = { 'Translate Culture': 'var(--opal)', MSQ: 'var(--mango)' };
const change = (a: number, b: number) => (b ? a / b - 1 : null);

export default function Paid({ data, today }: { data: PaidData; today: string }) {
  const [period, setPeriod] = useState<Period>(28);
  const [plat, setPlat] = useState<PlatformFilter>('All');
  const [agencyFilter, setAgencyFilter] = useState<'All' | Agency>('All');

  const lastAdDay = data.ads.reduce<string>((m, r) => (r.day > m && r.day < today ? r.day : m), '');
  const to = lastAdDay || shift(today, -1);
  const from = shift(to, -(period - 1)), prevTo = shift(from, -1), prevFrom = shift(prevTo, -(period - 1));
  const scope = (r: AdDay) => plat === 'All' || r.platform === plat;
  const cur = useMemo(() => data.ads.filter((r) => r.day >= from && r.day <= to && scope(r)), [data.ads, from, to, plat]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => data.ads.filter((r) => r.day >= prevFrom && r.day <= prevTo && scope(r)), [data.ads, prevFrom, prevTo, plat]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = totals(cur), tp = totals(prev);
  const byAgency = (['Translate Culture', 'MSQ'] as Agency[]).map((a) => ({ a, meta: totals(cur.filter((r) => r.agency === a && r.platform === 'Meta')), tiktok: totals(cur.filter((r) => r.agency === a && r.platform === 'TikTok')) }));

  // Organic / paid split per platform per day.
  const paidMap = useMemo(() => paidByDay(data.ads), [data.ads]);
  const igViews = useMemo(() => new Map(data.accountDays.filter((r) => r.platform === 'Instagram').map((r) => [r.date, r.views ?? 0])), [data.accountDays]);
  const ttViews = useMemo(() => new Map(data.accountDays.filter((r) => r.platform === 'TikTok').map((r) => [r.date, r.views ?? 0])), [data.accountDays]);
  const igModel = useMemo(() => igPaidModel(igViews, paidMap), [igViews, paidMap]);
  const ttLast = [...ttViews.entries()].filter(([, v]) => v > 0).map(([d]) => d).sort().pop() ?? to;
  const series = useMemo(() => {
    const out: { day: string; platform: 'Instagram' | 'TikTok'; organic: number; paid: number; spend: number }[] = [];
    for (let d = shift(to, -119); d <= to; d = shift(d, 1)) {
      const p = paidMap.get(d);
      if (igViews.has(d)) { const s = splitViews(d, 'Instagram', igViews.get(d) ?? 0, paidMap, igModel.k); out.push({ day: d, platform: 'Instagram', organic: s.organic, paid: s.paid, spend: p?.igSpend ?? 0 }); }
      if (ttViews.has(d) && d <= ttLast) { const s = splitViews(d, 'TikTok', ttViews.get(d) ?? 0, paidMap, null); out.push({ day: d, platform: 'TikTok', organic: s.organic, paid: s.paid, spend: p?.ttSpend ?? 0 }); }
    }
    return out;
  }, [to, paidMap, igViews, ttViews, igModel.k, ttLast]);
  const spikeList = useMemo(() => spikes(series).filter((x) => x.day >= shift(to, -89)), [series, to]);

  const eff = useMemo(() => efficiency(cur), [cur]);
  const camp = useMemo(() => campaigns(cur).filter((c) => agencyFilter === 'All' || c.agency === agencyFilter), [cur, agencyFilter]);
  const boostList = useMemo(() => boosts(data.ads.filter((r) => r.day >= shift(to, -119)), data.posts).filter((b) => b.lastDay >= from && (plat === 'All' || (plat === 'TikTok') === (b.post.platform === 'TikTok'))), [data.ads, data.posts, to, from, plat]);
  const ads = useMemo(() => {
    const m = new Map<string, AdDay[]>();
    for (const r of cur) (m.get(`${r.platform}:${r.ad_id}`) ?? m.set(`${r.platform}:${r.ad_id}`, []).get(`${r.platform}:${r.ad_id}`)!).push(r);
    const ownPosts = new Set(data.posts.map((p) => p.comment_key));
    return [...m.values()].map((rs) => { const x = totals(rs); return { r: rs[0], t: x, cpv: x.views ? (x.spend / x.views) * 1000 : null, epp: x.spend ? x.engagements / x.spend : null, boost: !!rs[0].post_key && ownPosts.has(rs[0].post_key) }; })
      .filter((a) => a.t.spend >= 50 && a.t.views > 0).sort((a, b) => (a.cpv ?? 1e9) - (b.cpv ?? 1e9));
  }, [cur, data.posts]);

  const splitCard = (platform: 'Instagram' | 'TikTok') => {
    const s = series.filter((x) => x.platform === platform);
    const now = s.filter((x) => x.day >= from && x.day <= to), before = s.filter((x) => x.day >= prevFrom && x.day <= prevTo);
    const sum = (xs: typeof s, k: 'organic' | 'paid') => xs.reduce((a, x) => a + x[k], 0);
    const o = sum(now, 'organic'), p = sum(now, 'paid'), ob = sum(before, 'organic'), pb = sum(before, 'paid');
    const recent = s.filter((x) => x.day >= shift(to, -Math.max(period, 28) + 1));
    const max = Math.max(1, ...recent.map((x) => x.organic + x.paid));
    const co = change(o, ob), cc = change(o + p, ob + pb);
    return (
      <div className="card" key={platform}>
        <div className="row" style={{ alignItems: 'baseline' }}><h3>{platform} views</h3><span className="muted" style={{ fontSize: '.78rem' }}>{day(from)} to {day(to)}</span></div>
        <div className="small4" style={{ marginTop: 10 }}>
          <div className="mini"><span className="eyebrow">Organic</span><div className="value"><CountUp value={o} format={(n) => compact(Math.round(n))} /></div><div className="meta muted">{co == null ? 'new' : `${co >= 0 ? 'up' : 'down'} ${pct(Math.abs(co), 0)}`}</div></div>
          <div className="mini"><span className="eyebrow">Paid</span><div className="value"><CountUp value={p} format={(n) => compact(Math.round(n))} /></div><div className="meta muted">{pct(o + p ? p / (o + p) : 0, 0)} of all views</div></div>
          <div className="mini"><span className="eyebrow">Combined</span><div className="value"><CountUp value={o + p} format={(n) => compact(Math.round(n))} /></div><div className="meta muted">{cc == null ? 'new' : `${cc >= 0 ? 'up' : 'down'} ${pct(Math.abs(cc), 0)}`}</div></div>
        </div>
        {co != null && cc != null && Math.abs(cc - co) > 0.15 && (
          <p className="note" style={{ marginTop: 8 }}><b>{cc > co ? 'Paid is flattering the topline.' : 'Organic is doing better than the topline shows.'}</b> Combined is {cc >= 0 ? 'up' : 'down'} {pct(Math.abs(cc), 0)}, organic {co >= 0 ? 'up' : 'down'} {pct(Math.abs(co), 0)}.</p>
        )}
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 140, marginTop: 12 }} role="img" aria-label={`${platform} daily views, organic and paid`}>
          {recent.map((x) => (
            <div key={x.day} title={`${day(x.day)}: organic ${int(x.organic)}, paid ${int(x.paid)}${x.spend ? `, ${gbp(x.spend)} spent` : ''}`} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', opacity: x.day < from ? 0.4 : 1 }}>
              <span style={{ display: 'block', height: `${(x.paid / max) * 100}%`, background: 'var(--lemon)', borderRadius: '2px 2px 0 0' }} />
              <span style={{ display: 'block', height: `${(x.organic / max) * 100}%`, background: 'var(--opal)' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '.75rem' }}>
          <span className="plat"><i style={{ background: 'var(--opal)' }} />Organic</span><span className="plat"><i style={{ background: 'var(--lemon)' }} />Paid</span>
          {recent.some((x) => x.day < from) && <span className="muted">Faded: before this period</span>}
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          {platform === 'Instagram'
            ? igModel.includesAds
              ? `Instagram's account views include ad views: across ${igModel.days} days, each Instagram ad impression added about ${(igModel.k ?? 0).toFixed(2)} account views (fit ${pct(igModel.correlation, 0)}). Paid is estimated from that and taken out.`
              : `Not enough evidence that Instagram's account views include ads, so ad impressions are added on top.`
            : `TikTok counts Spark Ad plays in the post's views, so they're taken out. Daily TikTok account figures arrive a day or two late.`}
        </p>
      </div>
    );
  };

  const agencyCols = eff.filter((e) => agencyFilter === 'All' || e.agency === agencyFilter);
  const best = (vals: (number | null)[], lower: boolean, i: number, platform: string) => {
    const same = agencyCols.map((e, j) => (e.platform === platform ? vals[j] : null)).filter((v): v is number => v != null);
    if (same.length < 2 || vals[i] == null) return false;
    return vals[i] === (lower ? Math.min(...same) : Math.max(...same));
  };
  const rowsDef: { label: string; get: (e: (typeof eff)[number]) => number | null; fmt: (v: number | null) => string; lower?: boolean; note?: string }[] = [
    { label: 'Spend', get: (e) => e.t.spend, fmt: (v) => gbp(v) },
    { label: 'Impressions', get: (e) => e.t.impressions, fmt: (v) => compact(v) },
    { label: 'Cost per 1,000 impressions', get: (e) => e.cpm, fmt: (v) => gbp(v, 2), lower: true },
    { label: 'Video views', get: (e) => e.t.views, fmt: (v) => compact(v), note: 'Meta 3-second plays; TikTok video views' },
    { label: 'Cost per 1,000 views', get: (e) => e.costPer1kViews, fmt: (v) => gbp(v, 2), lower: true },
    { label: 'Watched properly', get: (e) => e.t.thruplays, fmt: (v) => compact(v), note: 'Meta ThruPlays (15s or complete); TikTok 6-second views' },
    { label: 'Cost per proper watch', get: (e) => e.costPerThruplay, fmt: (v) => gbp(v, 3), lower: true },
    { label: 'Link clicks', get: (e) => e.t.clicks, fmt: (v) => compact(v) },
    { label: 'Cost per click', get: (e) => e.costPerClick, fmt: (v) => gbp(v, 2), lower: true },
    { label: 'Engagements per £', get: (e) => e.engagementsPerPound, fmt: (v) => (v == null ? 'n/a' : v.toFixed(1)), note: 'Likes, comments, shares, saves on the ads' },
    { label: 'Paid follows', get: (e) => e.t.follows || null, fmt: (v) => (v == null ? 'n/a' : int(v)), note: 'TikTok only' },
    { label: 'Cost per follow', get: (e) => e.costPerFollow, fmt: (v) => gbp(v, 2), lower: true },
  ];
  const objectives = (a: Agency, platform: string) => {
    const rs = cur.filter((r) => r.agency === a && r.platform === platform);
    const total = rs.reduce((s2, r) => s2 + r.spend, 0);
    const m = new Map<string, number>();
    for (const r of rs) { const k = (r.objective ?? 'Unknown').replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase(); m.set(k, (m.get(k) ?? 0) + r.spend); }
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, v]) => `${k} ${pct(total ? v / total : 0, 0)}`).join(', ');
  };

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <span className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>Paid · Meta and TikTok ad accounts · {day(from)} to {day(to)}</span>
          <h1>Paid</h1>
          <p className="take">
            <b>{gbp(t.spend)}</b> on {int(t.ads)} ads in the last {period} days{tp.spend ? <> ({t.spend >= tp.spend ? 'up' : 'down'} {pct(Math.abs(change(t.spend, tp.spend) ?? 0), 0)} on the {period} before)</> : null}.{' '}
            {byAgency.filter((b) => b.meta.spend + b.tiktok.spend > 0).map((b, i) => <span key={b.a}>{i ? ' ' : ''}{AGENCY_LABEL[b.a]} <b>{gbp(b.meta.spend + b.tiktok.spend)}</b> ({[b.meta.spend ? `Meta ${gbpk(b.meta.spend)}` : '', b.tiktok.spend ? `TikTok ${gbpk(b.tiktok.spend)}` : ''].filter(Boolean).join(', ')}).</span>)}
          </p>
          {data.lastSync && <p className="cap" style={{ color: 'rgba(255,255,255,.75)' }}>Last sync {new Date(data.lastSync.finished_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} · Meta and TikTok Ads via Windsor.ai</p>}
        </div>
      </header>

      <nav className="filters" aria-label="Filters">
        <div className="inner">
          <div className="seg" role="group" aria-label="Period">{([7, 28, 90] as Period[]).map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{p} days</button>)}</div>
          <div className="seg" role="group" aria-label="Platform">{(['All', 'Meta', 'TikTok'] as PlatformFilter[]).map((p) => <button key={p} type="button" aria-pressed={plat === p} onClick={() => setPlat(p)}>{p}</button>)}</div>
          <div className="seg" role="group" aria-label="Agency">{(['All', 'Translate Culture', 'MSQ'] as const).map((a) => <button key={a} type="button" aria-pressed={agencyFilter === a} onClick={() => setAgencyFilter(a)}>{a === 'All' ? 'Both agencies' : AGENCY_LABEL[a]}</button>)}</div>
        </div>
      </nav>

      <section className="band" id="split">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">So a good paid month doesn&apos;t pass for organic growth</span><h2>Organic, paid, combined</h2></div></div>
          <div className="grid2">{splitCard('Instagram')}{splitCard('TikTok')}</div>
          <p className="note">The Social page has the same switch (Organic, Paid, Combined) on its views and follows. Instagram follows can&apos;t be split: Meta doesn&apos;t report follows from ads.</p>
        </div>
      </section>

      <section className="band" id="agencies">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Same platform, same period · best on each row in bold</span><h2>Agency head to head</h2></div></div>
          {agencyCols.length === 0 ? <p className="empty">No paid activity in this period.</p> : (
            <div className="card tablewrap">
              <table>
                <thead>
                  <tr><th />{agencyCols.map((e) => <th key={`${e.agency}${e.platform}`} className="r"><span className="plat"><i style={{ background: AG_COL[e.agency] }} />{AGENCY_LABEL[e.agency]}</span><div className="muted" style={{ fontWeight: 400 }}>{e.platform}</div></th>)}</tr>
                </thead>
                <tbody>
                  {rowsDef.map((rd) => {
                    const vals = agencyCols.map(rd.get);
                    return (
                      <tr key={rd.label}>
                        <td>{rd.label}{rd.note && <div className="muted" style={{ fontSize: '.72rem' }}>{rd.note}</div>}</td>
                        {agencyCols.map((e, i) => <td key={`${e.agency}${e.platform}`} className="r" style={{ fontWeight: rd.lower !== undefined && best(vals, !!rd.lower, i, e.platform) ? 900 : 400 }}>{rd.fmt(vals[i])}</td>)}
                      </tr>
                    );
                  })}
                  <tr><td>Mostly buying</td>{agencyCols.map((e) => <td key={`${e.agency}${e.platform}`} className="r muted" style={{ fontSize: '.78rem' }}>{objectives(e.agency, e.platform)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="note">Read it like for like. The agencies buy different things (awareness, traffic, engagement), so cost per view will always favour reach buying and cost per click will favour traffic buying. MSQ&apos;s TikTok account isn&apos;t connected yet, so TikTok only shows Translate Culture for now.</p>
        </div>
      </section>

      <section className="band" id="boosts">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Ads that ran on our own posts (boosts and Spark Ads) and were live in this period</span><h2>Did paid help the post?</h2></div></div>
          {boostList.length === 0 ? <p className="empty">No boosted posts in this period.</p> : (
            <div className="card tablewrap">
              <table>
                <thead><tr><th>Post</th><th>Agency</th><th className="r">Spend</th><th className="r">Organic views</th><th className="r">Paid views</th><th className="r">Reach multiplier</th><th className="r">Organic vs usual</th><th className="r">£ per 1k paid</th><th>Read</th></tr></thead>
                <tbody>
                  {boostList.slice(0, 25).map((b) => {
                    const read = b.organicVsTypical == null ? 'Too few posts to compare' : b.organicVsTypical >= 1.5 ? 'Already flying organically: paid added to a winner' : b.organicVsTypical <= 0.7 ? 'Weak organically: paid carried it' : 'Normal organic, paid added reach';
                    return (
                      <tr key={b.post.comment_key}>
                        <td style={{ maxWidth: 300, whiteSpace: 'normal' }}>
                          <span className="plat" style={{ marginRight: 6 }}><i style={{ background: b.post.platform === 'TikTok' ? 'var(--s1)' : 'var(--s2)' }} />{b.post.platform}</span>
                          {safeHref(b.post.permalink) ? <a href={safeHref(b.post.permalink)} target="_blank" rel="noopener noreferrer">{(b.post.caption || '(no caption)').slice(0, 70)}</a> : (b.post.caption || '(no caption)').slice(0, 70)}
                          <div className="muted" style={{ fontSize: '.72rem' }}>Posted {day(b.post.posted)} · ads {day(b.firstDay)} to {day(b.lastDay)}</div>
                        </td>
                        <td>{b.agency.map((a) => AGENCY_LABEL[a]).join(', ')}</td>
                        <td className="r">{gbp(b.spend)}</td>
                        <td className="r">{compact(b.organicViews)}</td>
                        <td className="r">{compact(b.paidViews)}</td>
                        <td className="r">{b.lift ? `${b.lift.toFixed(1)}×` : 'n/a'}</td>
                        <td className="r">{b.organicVsTypical ? `${b.organicVsTypical.toFixed(1)}×` : 'n/a'}</td>
                        <td className="r">{gbp(b.costPer1kPaidViews, 2)}</td>
                        <td style={{ fontSize: '.8rem' }}>{read}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">Organic views on Instagram come straight from the post and exclude ads (Meta reports post views as organic only). On TikTok they are the post&apos;s organic plays as reported by the ad account, or total plays minus Spark plays. &ldquo;Organic vs usual&rdquo; compares with the middle of our unboosted posts on the same platform posted within 30 days. Many agency ads run as separate ad-only posts rather than boosts; they show under Best ads below.</p>
        </div>
      </section>

      <section className="band" id="spikes">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Days at 1.8× the usual views or more, last 90 days</span><h2>Spikes explained</h2></div></div>
          {spikeList.length === 0 ? <p className="empty">No spikes in the last 90 days.</p> : (
            <div className="feed">
              {spikeList.slice(0, 12).map((x) => (
                <article key={`${x.platform}${x.day}`} className="item" data-p={x.verdict === 'Paid' ? 'medium' : x.verdict === 'Organic' ? 'high' : 'low'}>
                  <div className="row" style={{ alignItems: 'center' }}><span className="brand">{x.platform} · {day(x.day)}</span><span className="act kind">{x.verdict === 'Paid' ? 'Paid-driven' : x.verdict === 'Organic' ? 'Organic' : 'Both'}</span></div>
                  <div className="title">{compact(x.combined)} views, {x.multiple.toFixed(1)}× a normal day</div>
                  <div className="sum">{pct(x.paidShare, 0)} paid{x.spend ? `, ${gbp(x.spend)} spent that day` : ''}. {x.verdict === 'Paid' ? 'Without ads this was an ordinary day.' : x.verdict === 'Organic' ? 'Organic did this on its own: worth finding the post.' : 'Organic rose too, so paid wasn’t the whole story.'}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="campaigns">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">By spend · {AGENCY_LABEL[agencyFilter as Agency] ?? 'both agencies'}</span><h2>Campaigns</h2></div></div>
          {camp.length === 0 ? <p className="empty">No campaigns in this period.</p> : (
            <div className="card tablewrap">
              <table>
                <thead><tr><th>Campaign</th><th>Agency</th><th>Platform</th><th>Buying</th><th className="r">Spend</th><th className="r">Impressions</th><th className="r">£ per 1k impr.</th><th className="r">Views</th><th className="r">£ per 1k views</th><th className="r">Clicks</th><th className="r">Follows</th></tr></thead>
                <tbody>
                  {camp.slice(0, 30).map((c) => (
                    <tr key={c.key}>
                      <td style={{ maxWidth: 280, whiteSpace: 'normal' }}><b>{c.campaign}</b><div className="muted" style={{ fontSize: '.72rem' }}>{day(c.first)} to {day(c.last)}</div></td>
                      <td><span className="plat"><i style={{ background: AG_COL[c.agency] }} />{AGENCY_LABEL[c.agency]}</span></td>
                      <td>{c.platform}</td>
                      <td style={{ fontSize: '.78rem' }}>{(c.objective ?? '').replace(/^OUTCOME_/, '').replace(/_/g, ' ').toLowerCase()}</td>
                      <td className="r">{gbp(c.t.spend)}</td>
                      <td className="r">{compact(c.t.impressions)}</td>
                      <td className="r">{gbp(c.cpm, 2)}</td>
                      <td className="r">{compact(c.t.views)}</td>
                      <td className="r">{gbp(c.costPer1kViews, 2)}</td>
                      <td className="r">{compact(c.t.clicks)}</td>
                      <td className="r">{c.t.follows ? int(c.t.follows) : 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="band" id="ads">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">£50 or more spent · cheapest views first</span><h2>Best ads</h2></div></div>
          {ads.length === 0 ? <p className="empty">No ads with £50+ spend and views in this period.</p> : (
            <div className="card tablewrap">
              <table>
                <thead><tr><th>Ad</th><th>Agency</th><th className="r">Spend</th><th className="r">Views</th><th className="r">£ per 1k views</th><th className="r">Engagements per £</th><th>Type</th></tr></thead>
                <tbody>
                  {ads.slice(0, 20).map((a) => (
                    <tr key={`${a.r.platform}${a.r.ad_id}`}>
                      <td style={{ maxWidth: 300, whiteSpace: 'normal' }}>
                        <span className="plat" style={{ marginRight: 6 }}><i style={{ background: a.r.platform === 'TikTok' ? 'var(--s1)' : 'var(--s2)' }} />{a.r.platform}</span>
                        {safeHref(a.r.post_link) ? <a href={safeHref(a.r.post_link)} target="_blank" rel="noopener noreferrer">{a.r.ad_name ?? a.r.ad_id}</a> : (a.r.ad_name ?? a.r.ad_id)}
                        <div className="muted" style={{ fontSize: '.72rem' }}>{a.r.campaign}</div>
                      </td>
                      <td>{AGENCY_LABEL[a.r.agency]}</td>
                      <td className="r">{gbp(a.t.spend)}</td>
                      <td className="r">{compact(a.t.views)}</td>
                      <td className="r">{gbp(a.cpv, 2)}</td>
                      <td className="r">{a.epp == null ? 'n/a' : a.epp.toFixed(1)}</td>
                      <td style={{ fontSize: '.78rem' }}>{a.boost ? 'Boost of our post' : a.r.spark ? 'Spark Ad' : 'Ad-only post'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">Cheapest views first, so read it alongside what each ad was buying. A cheap view from a reach campaign and a dear click from a traffic campaign can both be good buys.</p>
        </div>
      </section>

      <SectionNav sections={[{ id: 'split', label: 'Organic vs paid' }, { id: 'agencies', label: 'Agency head to head' }, { id: 'boosts', label: 'Did paid help?' }, { id: 'spikes', label: 'Spikes explained' }, { id: 'campaigns', label: 'Campaigns' }, { id: 'ads', label: 'Best ads' }]} />
      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Meta (WingstopUK-LPH: Translate Culture; WINGSTOP UK - MSQ: SMARTS MSQ) and TikTok (WINGSTOPUK: Translate Culture) ad accounts via Windsor.ai, refreshed nightly for the last 7 days. Spend in the ad accounts&apos; currency (GBP).</p><LphFooter /></div>
      </footer>
    </main>
  );
}
