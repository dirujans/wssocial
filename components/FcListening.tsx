'use client';

import type { FcListening, FcSignal } from '@/lib/flavourClub';
import CountUp from './CountUp';
import { SIGNAL_ICON } from './FcCommentWall';
import { compact, int, pct } from './format';

type Vs = { metric: 'views' | 'shares' | 'saves' | 'comments'; club: number | null; usual: number | null; index: number | null }[];
const DRIVERS: FcSignal[] = ['Catchphrase', 'The music', 'Cast spotted', 'Tagging mates', 'Funny'];
const FRICTION: FcSignal[] = ['Delivery apps', 'Old orders', 'Wants an app', 'Wants a store', 'Pushback'];
const FRICTION_NOTE: Partial<Record<FcSignal, string>> = {
  'Delivery apps': 'How stamps work on Deliveroo and Uber Eats',
  'Old orders': 'Wanting orders from before launch to count',
  'Wants an app': 'Asking for an app, or using the wallet pass',
  'Wants a store': 'Asking for a store near them',
};

/** The listening read for an exec: who is moving towards joining, what's making people talk, what's getting in the way. */
export default function FcListeningPanel({ l, vs, ourReplies, fanQuestions }: { l: FcListening; vs: Vs; ourReplies: number; fanQuestions: number }) {
  const ladderMax = Math.max(1, ...l.ladder.map((x) => x.n));
  const bar = (n: number, max: number, colour: string) => <span className="track"><span style={{ width: `${Math.max(0.5, (n / Math.max(1, max)) * 100)}%`, background: colour }} /></span>;
  const dMax = Math.max(1, ...DRIVERS.map((s) => l.signal[s])), fMax = Math.max(1, ...FRICTION.map((s) => l.signal[s]));
  return (
    <section className="band" id="listening">
      <div className="inner">
        <div className="band-head"><div><span className="eyebrow">Social listening · {int(l.total)} fan comments on the club posts</span><h2>What the comments tell us</h2></div></div>

        <div className="small4">
          <div className="mini hot"><span className="eyebrow">Net mood</span><div className="value">{l.mood.net == null ? 'n/a' : `${l.mood.net >= 0 ? '+' : ''}${Math.round(l.mood.net * 100)}`}</div><div className="meta muted">{int(l.mood.positive)} positive, {int(l.mood.negative)} negative or pushback</div></div>
          <div className="mini"><span className="eyebrow">Friends tagged</span><div className="value"><CountUp value={l.friendsTagged} format={(n) => int(n)} /></div><div className="meta muted">{pct(l.tagShare, 0)} of comments pull a mate in: free invites</div></div>
          <div className="mini"><span className="eyebrow">Say they joined</span><div className="value"><CountUp value={l.ladder[3].n} format={(n) => int(n)} /></div><div className="meta muted">plus {int(l.ladder[2].n)} who want to</div></div>
          <div className="mini"><span className="eyebrow">Our replies</span><div className="value"><CountUp value={ourReplies} format={(n) => int(n)} /></div><div className="meta muted">on TikTok, against {int(fanQuestions)} fan questions across both</div></div>
        </div>

        <div className="grid2" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>The intent ladder</h3>
            <p className="muted" style={{ fontSize: '.8rem', margin: '4px 0 12px' }}>Where each comment sits between noticing the club and joining it.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {l.ladder.map((x, i) => (
                <div key={x.step} className="hbar hbar-wide"><span className="lbl"><b>{x.step}</b><br /><span className="muted" style={{ fontSize: '.72rem' }}>{x.note}</span></span>{bar(x.n, ladderMax, ['var(--line-2)', 'var(--lemon)', 'var(--mango)', 'var(--opal)'][i])}<span className="val">{int(x.n)}</span></div>
              ))}
            </div>
            <p className="note" style={{ marginTop: 10 }}>Comments say intent, not sign-ups. Actual members need the Flavour Club platform or GA4 connected.</p>
          </div>
          <div className="card">
            <h3>What&apos;s making people talk</h3>
            <p className="muted" style={{ fontSize: '.8rem', margin: '4px 0 12px' }}>The parts of the launch people play back to us.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {DRIVERS.map((s) => <div key={s} className="hbar"><span className="lbl">{SIGNAL_ICON[s]} {s}</span>{bar(l.signal[s], dMax, 'var(--opal)')}<span className="val">{int(l.signal[s])}</span></div>)}
            </div>
            {l.emojis.length > 0 && (<>
              <h3 style={{ marginTop: 18 }}>Emoji pulse</h3>
              <div className="emoji-pulse">{l.emojis.map((e) => <span key={e.e} title={`${e.n} comments`}><span className="e">{e.e}</span><span className="n">{int(e.n)}</span></span>)}</div>
            </>)}
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 16 }}>
          <div className="card" style={{ borderColor: 'var(--atomic)' }}>
            <h3>Friction to fix</h3>
            <p className="muted" style={{ fontSize: '.8rem', margin: '4px 0 12px' }}>What gets in the way of joining or using it. Each one is a pinned reply, an FAQ line or a product fix.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              {FRICTION.map((s) => <div key={s} className="hbar hbar-wide"><span className="lbl">{SIGNAL_ICON[s]} {s}{FRICTION_NOTE[s] && <><br /><span className="muted" style={{ fontSize: '.72rem' }}>{FRICTION_NOTE[s]}</span></>}</span>{bar(l.signal[s], fMax, 'var(--atomic)')}<span className="val">{int(l.signal[s])}</span></div>)}
            </div>
            {l.places.length > 0 && <p className="note" style={{ marginTop: 10 }}><b>Stores asked for:</b> {l.places.map((p) => `${p.place} (${p.n})`).join(', ')}. Worth passing to the NSO team.</p>}
          </div>
          <div className="card">
            <h3>Club posts against our usual</h3>
            <p className="muted" style={{ fontSize: '.8rem', margin: '4px 0 12px' }}>Middle club post against our middle post in the 90 days before launch, platform by platform.</p>
            <div className="small4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {vs.map((v) => (
                <div key={v.metric} className="mini">
                  <span className="eyebrow">{v.metric}</span>
                  <div className="value">{v.index == null ? 'n/a' : `${v.index.toFixed(1)}×`}</div>
                  <div className="meta muted">{v.club == null ? 'no data yet' : `${compact(Math.round(v.club))} vs ${compact(Math.round(v.usual ?? 0))} usual`}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
