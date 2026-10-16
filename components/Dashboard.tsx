'use client';

import { useMemo, useState } from 'react';
import type { DashboardData } from '@/lib/data';
import { headlines, lastCompleteDay, takeaway, windowFor, type ChannelFilter, type Period } from '@/lib/metrics';
import { CHANNELS } from '@/lib/types';
import AlertsList from './AlertsList';
import ChannelTable from './ChannelTable';
import CommentsPanel from './CommentsPanel';
import DailyChart from './DailyChart';
import PostsTable from './PostsTable';
import { compact, day, pct, signedInt, signedPct, signedPts } from './format';

export default function Dashboard({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<Period>(28);
  const [channel, setChannel] = useState<ChannelFilter>('All');
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const last = useMemo(() => lastCompleteDay(data.days), [data.days]);
  const win = useMemo(() => (last ? windowFor(last, period) : null), [last, period]);
  const heads = useMemo(() => (win ? headlines(data.days, win, channel) : []), [data.days, win, channel]);
  const h = (m: string) => heads.find((x) => x.metric === m);
  const toggleChannel = (c: ChannelFilter) => { setChannel((cur) => (cur === c ? 'All' : c)); };

  if (!last || !win) {
    return (
      <main className="wrap">
        <h1>Wingstop UK Social</h1>
        <p className="empty">No data yet. Run the sync once (see the README) and refresh.</p>
      </main>
    );
  }

  const imp = h('impressions'), eng = h('engagements'), rate = h('engagement_rate'), fol = h('follower_growth');
  const word = (v: number | null | undefined) => (v == null ? 'flat' : `${v < 0 ? 'down' : 'up'} ${signedPct(v).slice(1)}`);
  const cls = (v: number | null | undefined) => (v == null ? '' : v >= 0 ? 'up' : 'down');

  return (
    <main className="wrap">
      <header>
        <h1>Wingstop UK Social</h1>
        <p className="take">
          {takeaway(heads)} Impressions <b className={cls(imp?.change)}>{word(imp?.change)}</b>, engagements{' '}
          <b className={cls(eng?.change)}>{word(eng?.change)}</b> against the {period} days before.
        </p>
        <p className="cap">
          {channel === 'All' ? 'All channels' : channel}, {day(win.curFrom)} to {day(win.curTo)}. From Sprout Social, Instagram and TikTok through Windsor.ai.
          {data.lastSync && <> Last sync {new Date(data.lastSync.finished_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} ({data.lastSync.status}).</>}
        </p>
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Period">
            {([7, 28, 60] as Period[]).map((p) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => { setPeriod(p); setPickedDay(null); }}>{p} days</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Channel">
            {(['All', ...CHANNELS] as ChannelFilter[]).map((c) => (
              <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}>{c}</button>
            ))}
          </div>
        </div>
      </header>

      {data.alerts.length > 0 && <AlertsList alerts={data.alerts} />}

      <section className="tiles" aria-label="Headline figures">
        <Tile label="Impressions" value={compact(imp?.current)} delta={`${signedPct(imp?.change)} vs ${compact(imp?.previous)}`} good={imp?.change} />
        <Tile label="Engagements" value={compact(eng?.current)} delta={`${signedPct(eng?.change)} vs ${compact(eng?.previous)}`} good={eng?.change} />
        <Tile label="Engagement rate" value={pct(rate?.current, 2)} delta={`${signedPts(rate?.change)} vs ${pct(rate?.previous, 2)}`} good={rate?.change} />
        <Tile
          label="Net new followers"
          value={signedInt(fol?.current)}
          delta={fol?.previous == null || fol?.current == null ? 'No earlier figure to compare' : `${signedInt(fol.current - fol.previous)} vs ${signedInt(fol.previous)} before`}
          good={fol?.previous == null || fol?.current == null ? null : fol.current - fol.previous}
        />
      </section>

      <DailyChart days={data.days} posts={data.posts} win={win} period={period} channel={channel} pickedDay={pickedDay} onPickDay={setPickedDay} onPickChannel={toggleChannel} />
      <ChannelTable days={data.days} win={win} period={period} channel={channel} onPick={toggleChannel} />
      <PostsTable posts={data.posts} comments={data.comments} from={win.curFrom} channel={channel} pickedDay={pickedDay} onClearDay={() => setPickedDay(null)} />
      <CommentsPanel comments={data.comments} posts={data.posts} channel={channel} />
    </main>
  );
}

function Tile({ label, value, delta, good }: { label: string; value: string; delta: string; good: number | null | undefined }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="big">{value}</div>
      <div className={`delta ${good == null ? '' : good >= 0 ? 'up' : 'down'}`}>{delta}</div>
    </div>
  );
}
