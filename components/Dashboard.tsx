'use client';

import { useMemo, useState } from 'react';
import type { DashboardData } from '@/lib/data';
import { headlines, lastCompleteDay, takeaway, windowFor, type ChannelFilter, type Period } from '@/lib/metrics';
import { socialToplines } from '@/lib/social';
import { CHANNELS } from '@/lib/types';
import AlertsList from './AlertsList';
import ChannelTable from './ChannelTable';
import CommentsArena from './CommentsArena';
import CompetitorPanel from './CompetitorPanel';
import DailyChart from './DailyChart';
import MentionsPanel from './MentionsPanel';
import PostWall from './PostWall';
import PostsTable from './PostsTable';
import SyncButton from './SyncButton';
import Toplines from './Toplines';
import WeeklyOutput from './WeeklyOutput';
import { signedPct } from './format';

export default function Dashboard({ data, today }: { data: DashboardData; today: string }) {
  const [period, setPeriod] = useState<Period>(28);
  const [channel, setChannel] = useState<ChannelFilter>('All');
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const last = useMemo(() => lastCompleteDay(data.days), [data.days]);
  const win = useMemo(() => (last ? windowFor(last, period) : null), [last, period]);
  const heads = useMemo(() => (win ? headlines(data.days, win, channel) : []), [data.days, win, channel]);
  const social = useMemo(() => socialToplines(data.accountDays, data.media, period, channel), [data.accountDays, data.media, period, channel]);
  const toggleChannel = (c: ChannelFilter) => setChannel((cur) => (cur === c ? 'All' : c));

  if (!last || !win) {
    return (
      <main className="shell">
        <header className="hero"><div className="inner"><span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span><h1>Social pulse</h1>
          <p className="take">No data yet. Press Sync now to pull the last 120 days from Windsor. It takes up to a minute.</p><SyncButton /></div></header>
      </main>
    );
  }

  const st = (m: string) => social?.toplines.find((t) => t.metric === m)?.change;
  const word = (v: number | null | undefined) => (v == null ? 'new' : `${v < 0 ? 'down' : 'up'} ${signedPct(v).slice(1)}`);
  const cls = (v: number | null | undefined) => (v == null ? '' : v >= 0 ? 'up' : 'down');
  const postsFrom = social?.from ?? win.curFrom;

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span>
          <h1>Social pulse</h1>
          <p className="take">
            {social ? (
              <>Shares <b className={cls(st('shares'))}>{word(st('shares'))}</b>, saves <b className={cls(st('saves'))}>{word(st('saves'))}</b>, reposts <b className={cls(st('reposts'))}>{word(st('reposts'))}</b> on the {period} days before. </>
            ) : null}
            {takeaway(heads)}
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
          <span style={{ marginLeft: 'auto' }}><SyncButton /></span>
        </div>
      </nav>

      {data.alerts.length > 0 && <section className="band" style={{ paddingTop: 18, paddingBottom: 18 }}><div className="inner"><AlertsList alerts={data.alerts} /></div></section>}

      <Toplines social={social?.toplines ?? null} from={social?.from ?? null} to={social?.to ?? null} period={period} heads={heads}
        scopeNote={channel === 'All' ? null : channel === 'Instagram' || channel === 'TikTok' ? `${channel} only.` : `${channel} has no shares, saves or reposts feed; the bottom row covers it.`} />
      <PostWall media={data.media} comments={data.comments} from={postsFrom} channel={channel} />
      <CommentsArena comments={data.comments} posts={data.posts} media={data.media} channel={channel} />
      <MentionsPanel mentions={data.mentions} />
      <CompetitorPanel items={data.competitors} />
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

      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Wingstop UK&amp;I internal. Data from Sprout Social, Instagram and TikTok through Windsor.ai, synced daily at 06:30. Mentions and competitor moves come from the morning briefs.</p></div>
      </footer>
    </main>
  );
}
