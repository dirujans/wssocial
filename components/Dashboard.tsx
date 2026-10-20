'use client';

import { useMemo, useState } from 'react';
import type { DashboardData } from '@/lib/data';
import { headlines, lastCompleteDay, takeaway, windowFor, type ChannelFilter, type Period } from '@/lib/metrics';
import { socialToplines, type ToplineAdjust } from '@/lib/social';
import { igPaidModel, splitAdjust, type PaidDay, type Split } from '@/lib/paid';
import { CHANNELS } from '@/lib/types';
import AlertsList from './AlertsList';
import ChannelTable from './ChannelTable';
import CommentsArena from './CommentsArena';
import DailyChart from './DailyChart';
import MentionsPanel from './MentionsPanel';
import PostWall from './PostWall';
import PostsTable from './PostsTable';
import SectionNav from './SectionNav';
import SyncButton from './SyncButton';
import Toplines from './Toplines';
import WeeklyOutput from './WeeklyOutput';
import { compact, signedPct } from './format';
import { LphFooter } from './Brand';

export default function Dashboard({ data, today, showSpend = false }: { data: DashboardData; today: string; showSpend?: boolean }) {
  const [period, setPeriod] = useState<Period>(28);
  const [channel, setChannel] = useState<ChannelFilter>('All');
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const last = useMemo(() => lastCompleteDay(data.days), [data.days]);
  const win = useMemo(() => (last ? windowFor(last, period) : null), [last, period]);
  const heads = useMemo(() => (win ? headlines(data.days, win, channel) : []), [data.days, win, channel]);
  // Organic / paid / combined: paid from the ad accounts, Instagram's share learnt from history (lib/paid igPaidModel).
  const [split, setSplit] = useState<Split>('organic');
  const paidMap = useMemo(() => new Map<string, PaidDay>(data.adsByDay.map((r) => [r.day, { igImpressions: r.ig_impressions, igSpend: r.ig_spend, igShares: r.ig_shares, igSaves: r.ig_saves, ttSparkPlays: r.tt_spark_plays, ttPlays: r.tt_plays, ttSparkShares: r.tt_spark_shares, ttShares: r.tt_shares, ttFollows: r.tt_follows, ttSpend: r.tt_spend, spend: r.spend }])), [data.adsByDay]);
  const igModel = useMemo(() => igPaidModel(new Map(data.accountDays.filter((r) => r.platform === 'Instagram').map((r) => [r.date, r.views ?? 0])), paidMap), [data.accountDays, paidMap]);
  const splits = useMemo(() => {
    const run = (sp: Split) => socialToplines(data.accountDays, data.media, period, channel, splitAdjust(sp, paidMap, igModel.k) as ToplineAdjust, { tiktokVideoSaves: sp !== 'paid' });
    return { organic: run('organic'), paid: run('paid'), combined: run('combined') };
  }, [data.accountDays, data.media, period, channel, paidMap, igModel.k]);
  const social = splits[split];
  const toggleChannel = (c: ChannelFilter) => setChannel((cur) => (cur === c ? 'All' : c));

  if (!last || !win) {
    return (
      <main className="shell">
        <header className="hero"><div className="inner"><span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span><h1>Social pulse</h1>
          <p className="take">No data yet. Press Sync now to pull the last 120 days from Windsor. It takes up to a minute.</p><SyncButton /></div></header>
      </main>
    );
  }

  const word = (v: number | null | undefined) => (v == null ? 'new' : `${v < 0 ? 'down' : 'up'} ${signedPct(v).slice(1)}`);
  const cls = (v: number | null | undefined) => (v == null ? '' : v >= 0 ? 'up' : 'down');
  const postsFrom = social?.from ?? win.curFrom;

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <h1>Social pulse</h1>
          <p className="take">
            {splits.organic ? (() => {
              const o = (m: string) => splits.organic!.toplines.find((t) => t.metric === m)?.change;
              const pv = (m: string) => splits.paid?.toplines.find((t) => t.metric === m)?.current ?? 0;
              const cv = (m: string) => splits.combined?.toplines.find((t) => t.metric === m)?.current ?? 0;
              const anyAds = data.adsByDay.some((r) => r.day >= splits.organic!.from && r.day <= splits.organic!.to && (r.ig_impressions > 0 || r.tt_plays > 0));
              const spend = data.adsByDay.filter((r) => r.day >= splits.organic!.from && r.day <= splits.organic!.to).reduce((x, r) => x + r.spend, 0);
              const share = cv('views') ? pv('views') / cv('views') : 0;
              return (<>
                <span className="take-line"><b>Organic:</b> shares <b className={cls(o('shares'))}>{word(o('shares'))}</b>, saves <b className={cls(o('saves'))}>{word(o('saves'))}</b>, reposts <b className={cls(o('reposts'))}>{word(o('reposts'))}</b>, views <b className={cls(o('views'))}>{word(o('views'))}</b> on the {period} days before.</span>{' '}
                {anyAds && <span className="take-line"><b>Paid on top:</b> {showSpend && spend > 0 ? <>£{Math.round(spend).toLocaleString('en-GB')} spent, adding</> : 'ads added'} {compact(pv('views'))} views ({Math.round(share * 100)}% of all views), {compact(pv('shares'))} shares and {compact(pv('saves'))} saves.</span>}{' '}
              </>);
            })() : null}
            {takeaway(heads) && <span className="take-line muted-line"><b>All channels (Sprout, paid included):</b> {takeaway(heads)}</span>}
          </p>
          {data.lastSync && (
            <p className="cap" style={{ color: 'rgba(255,255,255,.75)' }}>
              Last sync {new Date(data.lastSync.finished_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} · Sprout, Instagram and TikTok via Windsor.ai
            </p>
          )}
        </div>
      </header>

      <nav className="filters" aria-label="Filters">
        <div className="inner">
          <div className="seg" role="group" aria-label="Period">
            {([7, 28, 60] as Period[]).map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => { setPeriod(p); setPickedDay(null); }}>{p} days</button>)}
          </div>
          <div className="seg" role="group" aria-label="Channel">
            {(['All', ...CHANNELS] as ChannelFilter[]).map((c) => <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}>{c}</button>)}
          </div>
          <div className="seg" role="group" aria-label="Organic or paid" title="Switches every topline: shares, saves, reposts, views and new follows.">
            {([['organic', 'Organic'], ['paid', 'Paid'], ['combined', 'Combined']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={split === k} onClick={() => setSplit(k)}>{l}</button>)}
          </div>
          <span style={{ marginLeft: 'auto' }}><SyncButton /></span>
        </div>
      </nav>

      {data.alerts.length > 0 && <section className="band" style={{ paddingTop: 18, paddingBottom: 18 }}><div className="inner"><AlertsList alerts={data.alerts} /></div></section>}

      <Toplines social={social?.toplines ?? null} from={social?.from ?? null} to={social?.to ?? null} period={period} heads={heads} split={split} igK={igModel.k}
        scopeNote={channel === 'All' ? null : channel === 'Instagram' || channel === 'TikTok' ? `${channel} only.` : `${channel} has no shares, saves or reposts feed; the bottom row covers it.`} />
      <PostWall media={data.media} comments={data.comments} from={postsFrom} channel={channel} />
      <CommentsArena comments={data.comments} posts={data.posts} media={data.media} channel={channel} />
      <MentionsPanel mentions={data.mentions} />
      <WeeklyOutput posts={data.posts} today={today} />

      <section className="band" id="numbers">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Sprout Social · all channels</span><h2>The numbers underneath</h2></div></div>
          <DailyChart days={data.days} posts={data.posts} win={win} period={period} channel={channel} pickedDay={pickedDay} onPickDay={setPickedDay} onPickChannel={toggleChannel} />
          <ChannelTable days={data.days} win={win} period={period} channel={channel} onPick={toggleChannel} />
          <details className="card">
            <summary><h3 style={{ display: 'inline' }}>Every post, every channel</h3> <span className="muted" style={{ fontSize: '.85rem' }}>· tap to open, includes Facebook, LinkedIn and stories</span></summary>
            <PostsTable posts={data.posts} comments={data.comments} from={win.curFrom} channel={channel} pickedDay={pickedDay} onClearDay={() => setPickedDay(null)} />
          </details>
        </div>
      </section>

      <SectionNav sections={[{ id: 'toplines', label: 'Toplines' }, { id: 'posts', label: 'What landed' }, { id: 'comments', label: 'Comments' }, { id: 'mentions', label: 'Mentions' }, { id: 'output', label: 'Weekly output' }, { id: 'numbers', label: 'The numbers' }]} />
      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Wingstop UK&amp;I internal. Data from Sprout Social, Instagram and TikTok through Windsor.ai, synced daily at 06:30. Mentions and competitor moves come from the morning briefs.</p><LphFooter /></div>
      </footer>
    </main>
  );
}
