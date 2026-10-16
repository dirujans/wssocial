'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shiftDay, type ChannelFilter, type Period, type Window } from '@/lib/metrics';
import { CHANNELS, type Post, type ProfileDay } from '@/lib/types';
import { CHANNEL_COLOUR, compact, day, int } from './format';

type Measure = 'impressions' | 'engagements';

export default function DailyChart(props: {
  days: ProfileDay[]; posts: Post[]; win: Window; period: Period; channel: ChannelFilter;
  pickedDay: string | null; onPickDay: (d: string | null) => void; onPickChannel: (c: ChannelFilter) => void;
}) {
  const { days, posts, win, period, channel, pickedDay, onPickDay, onPickChannel } = props;
  const [measure, setMeasure] = useState<Measure>('impressions');
  const from = shiftDay(win.curFrom, -period), to = shiftDay(win.curTo, 1);

  const rows = useMemo(() => {
    const out: Record<string, string | number | null>[] = [];
    for (let d = from; d <= to; d = shiftDay(d, 1)) {
      const r: Record<string, string | number | null> = { date: d };
      for (const c of CHANNELS) r[c] = days.find((x) => x.date === d && x.channel === c)?.[measure] ?? null;
      r.posts = posts.filter((p) => p.posted === d && p.format !== 'Story' && (channel === 'All' || p.channel === channel)).length;
      out.push(r);
    }
    return out;
  }, [days, posts, from, to, measure, channel]);

  const shown = channel === 'All' ? CHANNELS : [channel];

  return (
    <section className="card" id="daily">
      <div className="row">
        <div>
          <h2>Daily {measure}{channel === 'All' ? ' by channel' : `, ${channel}`}</h2>
          <p className="note">The shaded band is the previous {period} days. Click a day to see what went out; click a line to filter to that channel.</p>
        </div>
        <div className="seg" role="group" aria-label="Measure">
          {(['impressions', 'engagements'] as Measure[]).map((m) => (
            <button key={m} type="button" aria-pressed={measure === m} onClick={() => setMeasure(m)}>{m[0].toUpperCase() + m.slice(1)}</button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 320, marginTop: 12 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            onClick={(e) => { const d = e?.activeLabel as string | undefined; if (d) onPickDay(pickedDay === d ? null : d); }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <ReferenceArea x1={from} x2={shiftDay(win.curFrom, -1)} fill="var(--line)" fillOpacity={0.45} ifOverflow="extendDomain" />
            <XAxis dataKey="date" tickFormatter={day} minTickGap={40} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" />
            <YAxis tickFormatter={(v: number) => compact(v)} tick={{ fill: 'var(--muted)', fontSize: 12 }} stroke="var(--line)" width={56} />
            <Tooltip
              content={({ active, label, payload }) =>
                active && payload?.length ? (
                  <div className="tip">
                    <div className="muted">{day(String(label))}</div>
                    {payload.filter((p) => p.value != null).sort((a, b) => Number(b.value) - Number(a.value)).map((p) => (
                      <div key={String(p.dataKey)}><span className="sw" style={{ background: String(p.color) }} />{String(p.dataKey)} {int(Number(p.value))}</div>
                    ))}
                    <div className="muted">{Number(payload[0].payload.posts) ? `${payload[0].payload.posts} posts · ` : ''}click to see posts</div>
                  </div>
                ) : null
              }
            />
            {pickedDay && <ReferenceLine x={pickedDay} stroke="var(--fg)" strokeDasharray="3 3" />}
            {shown.map((c) => (
              <Line key={c} type="linear" dataKey={c} stroke={CHANNEL_COLOUR[c]} strokeWidth={2} dot={false} connectNulls={false}
                activeDot={{ r: 4 }} isAnimationActive={false} onClick={() => onPickChannel(c)} style={{ cursor: 'pointer' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
