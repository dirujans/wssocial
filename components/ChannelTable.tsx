'use client';

import { headlines, type ChannelFilter, type Period, type Window } from '@/lib/metrics';
import { CHANNELS, type ProfileDay } from '@/lib/types';
import { CHANNEL_COLOUR, int, pct, signedInt, signedPct } from './format';

export default function ChannelTable({ days, win, period, channel, onPick }: {
  days: ProfileDay[]; win: Window; period: Period; channel: ChannelFilter; onPick: (c: ChannelFilter) => void;
}) {
  const rows = CHANNELS.map((c) => {
    const h = headlines(days, win, c);
    const g = (m: string) => h.find((x) => x.metric === m);
    const inWin = days.filter((r) => r.channel === c && r.date >= win.curFrom && r.date <= win.curTo);
    const latest = days.filter((r) => r.channel === c && r.date <= win.curTo && r.followers != null).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return {
      c, imp: g('impressions')?.current ?? 0, change: g('impressions')?.change ?? null, eng: g('engagements')?.current ?? 0,
      rate: g('engagement_rate')?.current ?? null, followers: latest?.followers ?? null, growth: g('follower_growth')?.current ?? null,
      posts: inWin.reduce((s, r) => s + (r.posts_sent ?? 0), 0),
    };
  }).sort((a, b) => b.imp - a.imp);

  return (
    <section className="card" id="channels">
      <h2>By channel, last {period} days</h2>
      <p className="note">Click a channel to filter the whole page. Engagement rate is engagements divided by impressions.</p>
      <div className="tablewrap">
        <table>
          <thead><tr>
            <th>Channel</th><th className="num">Impressions</th><th className="num">vs period before</th><th className="num">Engagements</th>
            <th className="num">Eng. rate</th><th className="num">Followers</th><th className="num hide-sm">Net new</th><th className="num hide-sm">Posts</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c} className={`click ${channel === r.c ? 'sel' : ''}`} tabIndex={0} aria-label={`Filter to ${r.c}`}
                onClick={() => onPick(r.c)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.c); } }}>
                <td><span className="sw" style={{ background: CHANNEL_COLOUR[r.c] }} />{r.c}</td>
                <td className="num">{int(r.imp)}</td>
                <td className={`num ${r.change == null ? '' : r.change >= 0 ? 'up' : 'down'}`}>{signedPct(r.change)}</td>
                <td className="num">{int(r.eng)}</td>
                <td className="num">{pct(r.rate, 2)}</td>
                <td className="num">{int(r.followers)}</td>
                <td className="num hide-sm">{signedInt(r.growth)}</td>
                <td className="num hide-sm">{int(r.posts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
