'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AudienceData } from '@/lib/data';
import { flavourScores, instagramDemo, latestDay, sentimentOf, sentimentSplit, tiktokDemo, totalOf, type FlavourScore } from '@/lib/audience';
import type { Comment, Mention, Theme } from '@/lib/types';
import CountUp from './CountUp';
import SyncButton from './SyncButton';
import { CHANNEL_COLOUR, compact, day, int, pct, safeHref } from './format';

type Win = 7 | 30 | 60;
type FSort = 'talked' | 'loved' | 'divisive';
const THEMES: Theme[] = ['Love', "Where's ours?", 'Wants in', 'Tagging a friend', 'Pushback'];
const THEME_WHY: Record<string, string> = {
  Love: 'Praise, fire emojis, "the best"',
  "Where's ours?": 'Asking for a Wingstop near them',
  'Wants in': 'Asking how to get it, giveaways',
  'Tagging a friend': 'Pulling a mate into the post',
  Pushback: 'Complaints, price, quality',
};
const SENT_COLOUR = { positive: 'var(--opal)', neutral: 'var(--line-2)', mixed: 'var(--lemon)', negative: 'var(--atomic)' };
const REGION = (() => { try { return new Intl.DisplayNames(['en-GB'], { type: 'region' }); } catch { return null; } })();
const regionName = (cc: string) => (cc === 'GB' ? 'UK' : cc === 'US' ? 'USA' : (() => { try { return REGION?.of(cc) ?? cc; } catch { return cc; } })());
const shift = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function Delta({ cur, avg }: { cur: number; avg: number | null | undefined }) {
  if (avg == null || avg === 0) return null;
  const v = cur / avg - 1;
  return <span className={`delta ${v >= 0 ? 'up' : 'down'}`}>{v >= 0 ? '▲' : '▼'} {Math.abs(v * 100).toFixed(0)}% vs 7d avg</span>;
}

function Bar({ share, colour, label, value }: { share: number; colour: string; label: string; value: string }) {
  return (
    <div className="hbar">
      <span className="lbl">{label}</span>
      <span className="track"><span style={{ width: `${Math.max(0.5, share * 100)}%`, background: colour }} /></span>
      <span className="val">{value}</span>
    </div>
  );
}

export default function Audience({ data, today, now }: { data: AudienceData; today: string; now: string }) {
  const [win, setWin] = useState<Win>(30);
  const [fsort, setFsort] = useState<FSort>('talked');
  const [plat, setPlat] = useState<string>('all');
  const from = shift(today, -win);

  const comments = useMemo(() => data.comments.filter((c) => c.post_date >= from), [data.comments, from]);
  const mentions = useMemo(() => data.mentions.filter((m) => (m.posted_on ?? '') >= from), [data.mentions, from]);
  const flavours = useMemo(() => flavourScores(comments, mentions), [comments, mentions]);
  const sent = useMemo(() => sentimentSplit(comments), [comments]);
  const day1 = useMemo(() => latestDay(data.accountDays), [data.accountDays]);
  const ig = useMemo(() => instagramDemo(data.demo), [data.demo]);
  const tt = useMemo(() => tiktokDemo(data.demo), [data.demo]);

  const igUK = totalOf(data.demo, 'Instagram'), igIE = totalOf(data.demo, 'Instagram IE'), ttF = totalOf(data.demo, 'TikTok');
  const ttLikes = totalOf(data.demo, 'TikTok', 'likes');
  const followers = (igUK ?? 0) + (igIE ?? 0) + (ttF ?? 0);
  const follows7 = data.accountDays.filter((r) => r.date > shift(today, -8)).reduce((s, r) => s + (r.follows ?? 0), 0);

  const since24 = new Date(Date.parse(now) - 864e5).toISOString();
  const new24 = data.comments.filter((c) => c.commented_at && c.commented_at >= since24).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  const themeCounts = THEMES.map((t) => ({ t, n: comments.filter((c) => c.theme === t).length }));
  const topComments = comments.filter((c) => c.theme !== 'Pushback' && c.theme !== 'Tagging a friend' && c.text.replace(/@[\w.]+/g, '').trim().length > 6).slice().sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 9);
  const hero = topComments[0];
  const loudPushback = comments.filter((c) => c.theme === 'Pushback').sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 3);

  const talked = flavours.filter((f) => f.mentions > 0);
  const flavourTotal = flavours.reduce((s, f) => s + f.mentions, 0);
  const sortedF = [...flavours].sort((a, b) =>
    fsort === 'talked' ? b.mentions - a.mentions
      : fsort === 'loved' ? (b.net ?? -2) - (a.net ?? -2) || b.mentions - a.mentions
        : (b.negative + b.mixed) / (b.mentions || 1) - (a.negative + a.mixed) / (a.mentions || 1) || b.mentions - a.mentions);
  const mostLoved = talked.filter((f) => f.mentions >= 3).sort((a, b) => (b.net ?? 0) - (a.net ?? 0))[0];
  const mostTalked = talked.slice().sort((a, b) => b.mentions - a.mentions)[0];

  const sources = [...new Set(mentions.map((m) => m.source ?? 'Other'))].map((s) => ({ s, n: mentions.filter((m) => (m.source ?? 'Other') === s).length })).sort((a, b) => b.n - a.n);
  const hype = mentions.filter((m) => ['praise', 'creator'].includes((m.kind ?? '').toLowerCase())).length;
  const mFeed = mentions.filter((m) => plat === 'all' || (m.source ?? 'Other') === plat);

  return (
    <main className="shell">
      <header className="hero">
        <div className="inner">
          <div className="row" style={{ alignItems: 'center' }}>
            <span className="wordmark">Wingstop UK&amp;I<span className="dot" />Social</span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/" className="chip" style={{ textDecoration: 'none' }}>Our channels</Link>
              <Link href="/competitors" className="chip" style={{ textDecoration: 'none' }}>Competitor watch</Link>
            </span>
          </div>
          <h1>Our audience</h1>
          <p className="take">
            <b>{compact(followers)}</b> people follow us across Instagram and TikTok.
            {day1.total.date ? <> On {day(day1.instagram.date)} they gave us <b>{compact(day1.total.views)}</b> views, <b>{compact(day1.total.shares)}</b> shares and <b>{compact(day1.total.saves)}</b> saves.</> : null}
            {mostTalked ? <> Most talked-about flavour this {win === 7 ? 'week' : 'month'}: <b>{mostTalked.name}</b>{mostLoved && mostLoved.name !== mostTalked.name ? <>; most loved: <b>{mostLoved.name}</b></> : null}.</> : null}
          </p>
          {data.lastSync && <p className="cap" style={{ color: 'rgba(255,255,255,.75)' }}>Last sync {new Date(data.lastSync.finished_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} · Instagram and TikTok via Windsor.ai · mentions from the morning report</p>}
        </div>
      </header>

      <nav className="filters" aria-label="Filters">
        <div className="inner">
          <div className="seg" role="group" aria-label="Period">
            {([7, 30, 60] as Win[]).map((w) => <button key={w} type="button" aria-pressed={win === w} onClick={() => setWin(w)}>{w} days</button>)}
          </div>
          <span className="muted" style={{ fontSize: '.8rem' }}>Period applies to comments, flavours and mentions</span>
          <span style={{ marginLeft: 'auto' }}><SyncButton /></span>
        </div>
      </nav>

      {/* ---------- Following ---------- */}
      <section className="band" id="following">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Right now</span><h2>Our following</h2></div></div>
          <div className="big3">
            <article className="big-card lead rise d1">
              <span className="label">Total followers</span>
              <div className="value"><CountUp value={followers} format={(n) => compact(Math.round(n))} /></div>
              <div className="meta"><span className="split">
                {igUK != null && <span>Instagram UK {compact(igUK)}</span>}
                {igIE != null && <span>Instagram IE {compact(igIE)}</span>}
                {ttF != null && <span>TikTok {compact(ttF)}</span>}
              </span></div>
              <p className="why-note">{follows7 ? `${int(follows7)} new follows in the last 7 days.` : 'New follows fill in as daily data arrives.'}</p>
            </article>
            <article className="big-card rise d2">
              <span className="label">TikTok</span>
              <div className="value"><CountUp value={ttF} format={(n) => compact(Math.round(n))} /></div>
              <div className="meta"><span className="muted">{ttLikes ? `${compact(ttLikes)} lifetime likes` : 'followers'}</span></div>
              <p className="why-note">{ttF && followers ? `${pct(ttF / followers, 0)} of our total following.` : ''}</p>
            </article>
            <article className="big-card rise d3">
              <span className="label">Instagram</span>
              <div className="value"><CountUp value={(igUK ?? 0) + (igIE ?? 0)} format={(n) => compact(Math.round(n))} /></div>
              <div className="meta"><span className="muted">UK{igIE != null ? ' and Ireland' : ''}</span></div>
              <p className="why-note">{igIE == null ? 'Ireland’s count appears after the next sync.' : ''}</p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- Last full day ---------- */}
      <section className="band" id="last-day">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">Instagram {day(day1.instagram.date)} · TikTok {day(day1.tiktok.date)} · platforms report by full day</span><h2>The last 24 hours</h2></div>
          </div>
          <div className="small4 stat7">
            {(['views', 'likes', 'comments', 'shares', 'saves', 'reposts', 'follows'] as const).map((k, i) => (
              <div key={k} className={`mini rise d${(i % 4) + 1} ${['shares', 'saves'].includes(k) ? 'hot' : ''}`}>
                <span className="eyebrow">{k === 'follows' ? 'New follows' : k}</span>
                <div className="value"><CountUp value={day1.total[k]} format={(n) => compact(Math.round(n))} /></div>
                <div className="meta">
                  <Delta cur={day1.total[k]} avg={day1.total.avg7[k]} />
                </div>
                <div className="meta muted" style={{ fontSize: '.74rem' }}>IG {compact(day1.instagram[k])}{k !== 'reposts' ? ` · TikTok ${compact(day1.tiktok[k])}` : ''}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="row" style={{ alignItems: 'baseline' }}><h3>New comments, last 24 hours</h3><span className="muted" style={{ fontSize: '.8rem' }}>{new24.length} on Instagram · TikTok doesn&apos;t time-stamp comments</span></div>
            {new24.length === 0 ? <p className="note">No new timestamped comments in the last 24 hours yet.</p> : (
              <div className="cgrid" style={{ marginTop: 10 }}>{new24.slice(0, 6).map((c) => <CommentTile key={c.comment_id} c={c} />)}</div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- What they're saying ---------- */}
      <section className="band" id="saying">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">{int(comments.length)} comments under our posts · last {win} days</span><h2>What they&apos;re saying</h2></div></div>
          <div className="grid2">
            <div className="card">
              <h3>Mood</h3>
              <div className="stack" role="img" aria-label="Comment sentiment split">
                {(['positive', 'neutral', 'mixed', 'negative'] as const).map((k) => sent[k] ? <span key={k} style={{ flex: sent[k], background: SENT_COLOUR[k] }} title={`${k} ${sent[k]}`} /> : null)}
              </div>
              <div className="legend">
                {(['positive', 'neutral', 'mixed', 'negative'] as const).map((k) => <span key={k}><i style={{ background: SENT_COLOUR[k] }} />{k} {pct(sent[k] / (sent.total || 1), 0)}</span>)}
              </div>
              <div className="bigline">
                <b>{sent.positiveShare != null ? pct(sent.positiveShare, 0) : '—'}</b>
                <span>of comments with an opinion are positive</span>
              </div>
              <p className="note">Keyword rules, not AI: read the comments before quoting a number upward.</p>
            </div>
            <div className="card">
              <h3>Why they comment</h3>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {themeCounts.map(({ t, n }) => <Bar key={t} label={t} share={n / Math.max(1, ...themeCounts.map((x) => x.n))} colour={t === 'Pushback' ? 'var(--atomic)' : t === 'Love' ? 'var(--opal)' : t === "Where's ours?" ? 'var(--lemon)' : t === 'Wants in' ? 'var(--mango)' : 'var(--hawaiian)'} value={int(n)} />)}
              </div>
              <p className="note" style={{ marginTop: 10 }}>{themeCounts.map(({ t }) => `${t}: ${THEME_WHY[t]}`).join(' · ')}</p>
            </div>
          </div>
          {hero && (
            <div className="spotlight" style={{ marginTop: 14 }}>
              <span className="eyebrow" style={{ color: 'rgba(0,0,0,.7)' }}>Loudest comment · {hero.platform} · {day(hero.post_date)}</span>
              <div className="q" style={{ marginTop: 8 }}>&ldquo;{hero.text}&rdquo;</div>
              <div className="meta"><span className="likes">{int(hero.likes)}</span><span>likes</span>{safeHref(hero.post_link) && <a href={safeHref(hero.post_link)} target="_blank" rel="noopener noreferrer" style={{ color: '#000' }}>See the post</a>}</div>
            </div>
          )}
          <div className="cgrid" style={{ marginTop: 14 }}>{topComments.slice(1).map((c) => <CommentTile key={c.comment_id} c={c} />)}</div>
          {loudPushback.length > 0 && (
            <div className="card" style={{ marginTop: 14, borderColor: 'var(--atomic)' }}>
              <h3>Pushback worth reading</h3>
              <div className="cgrid" style={{ marginTop: 10 }}>{loudPushback.map((c) => <CommentTile key={c.comment_id} c={c} />)}</div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Flavours ---------- */}
      <section className="band" id="flavours">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">The core ten plus Hot Honey and Sriracha Hot Honey · {int(flavourTotal)} flavour mentions · last {win} days</span><h2>Flavour pulse</h2></div>
            <div className="seg" role="group" aria-label="Sort flavours">
              {([['talked', 'Most talked about'], ['loved', 'Most loved'], ['divisive', 'Most divisive']] as [FSort, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={fsort === k} onClick={() => setFsort(k)}>{l}</button>)}
            </div>
          </div>
          {flavourTotal > 0 && (
            <div className="stack tall" role="img" aria-label="Share of flavour conversation">
              {talked.sort((a, b) => b.mentions - a.mentions).map((f) => <span key={f.name} style={{ flex: f.mentions, background: f.colour }} title={`${f.name} ${f.mentions}`}>{f.mentions / flavourTotal > 0.07 ? f.name : ''}</span>)}
            </div>
          )}
          <div className="fgrid">
            {sortedF.map((f, i) => <FlavourCard key={f.name} f={f} rank={i + 1} total={flavourTotal} />)}
          </div>
          <p className="note">Counts comments under our posts that name a flavour, plus unprompted mentions from the morning report. A comment naming two flavours counts for both. Spellings are matched loosely (&ldquo;mango hab&rdquo;, &ldquo;siracha&rdquo;).</p>
        </div>
      </section>

      {/* ---------- Unprompted ---------- */}
      <section className="band" id="mentions">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">Talking about us on their own channels · last {win} days</span><h2>Unprompted</h2></div>
            <div className="seg" role="group" aria-label="Platform">
              <button type="button" aria-pressed={plat === 'all'} onClick={() => setPlat('all')}>All<span className="count">{mentions.length}</span></button>
              {sources.map(({ s, n }) => <button key={s} type="button" aria-pressed={plat === s} onClick={() => setPlat(s)}>{s}<span className="count">{n}</span></button>)}
            </div>
          </div>
          <div className="small4">
            <div className="mini"><span className="eyebrow">Mentions found</span><div className="value"><CountUp value={mentions.length} format={(n) => int(n)} /></div><div className="meta muted">across {sources.length} platforms</div></div>
            <div className="mini"><span className="eyebrow">Hype</span><div className="value">{mentions.length ? pct(hype / mentions.length, 0) : '—'}</div><div className="meta muted">praise and creator content</div></div>
            <div className="mini"><span className="eyebrow">Need a reply</span><div className="value"><CountUp value={mentions.filter((m) => ['reply', 'engage', 'escalate'].includes((m.action ?? '').toLowerCase()) && !m.done).length} format={(n) => int(n)} /></div><div className="meta muted">reply, engage or escalate</div></div>
            <div className="mini"><span className="eyebrow">Biggest source</span><div className="value" style={{ fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>{sources[0]?.s ?? '—'}</div><div className="meta muted">{sources[0] ? `${sources[0].n} mentions` : ''}</div></div>
          </div>
          {mFeed.length === 0 ? <p className="empty">Nothing logged for this filter yet. The 07:47 report searches TikTok, Reddit, reviews, press and X every morning.</p> : (
            <div className="feed" style={{ marginTop: 14 }}>
              {mFeed.slice(0, 18).map((m) => <MentionCard key={m.id} m={m} />)}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Demographics ---------- */}
      <section className="band" id="who">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Followers, from Instagram and TikTok insights</span><h2>Who we reach</h2></div></div>
          <div className="grid2">
            <div className="card">
              <div className="row" style={{ alignItems: 'baseline' }}><h3>Instagram</h3><span className="muted" style={{ fontSize: '.8rem' }}>{int(ig.followersInAges)} followers with age data</span></div>
              <div className="stack" style={{ marginTop: 12 }} role="img" aria-label="Instagram gender split">
                {ig.gender.map((g) => <span key={g.key} style={{ flex: g.value, background: g.key === 'Women' ? 'var(--louisiana)' : g.key === 'Men' ? 'var(--hawaiian)' : 'var(--line-2)' }} />)}
              </div>
              <div className="legend">{ig.gender.map((g) => <span key={g.key}><i style={{ background: g.key === 'Women' ? 'var(--louisiana)' : g.key === 'Men' ? 'var(--hawaiian)' : 'var(--line-2)' }} />{g.key} {pct(g.share, 0)}</span>)}</div>
              <h4 className="sub-h">Age</h4>
              <div style={{ display: 'grid', gap: 7 }}>
                {ig.ages.map((a) => (
                  <div key={a.key} className="hbar">
                    <span className="lbl">{a.key}</span>
                    <span className="track split3">
                      <span style={{ width: `${(a.F / Math.max(...ig.ages.map((x) => x.total))) * 100}%`, background: 'var(--louisiana)' }} />
                      <span style={{ width: `${(a.M / Math.max(...ig.ages.map((x) => x.total))) * 100}%`, background: 'var(--hawaiian)' }} />
                      <span style={{ width: `${(a.U / Math.max(...ig.ages.map((x) => x.total))) * 100}%`, background: 'var(--line-2)' }} />
                    </span>
                    <span className="val">{pct(a.share, 0)}</span>
                  </div>
                ))}
              </div>
              <h4 className="sub-h">Top cities</h4>
              <div style={{ display: 'grid', gap: 7 }}>
                {ig.cities.map((c) => <Bar key={c.key} label={c.key} share={c.value / (ig.cities[0]?.value || 1)} colour="var(--opal)" value={compact(c.value)} />)}
              </div>
            </div>
            <div className="card">
              <div className="row" style={{ alignItems: 'baseline' }}><h3>TikTok</h3><span className="muted" style={{ fontSize: '.8rem' }}>share of followers</span></div>
              <div className="stack" style={{ marginTop: 12 }} role="img" aria-label="TikTok gender split">
                {tt.gender.map((g) => <span key={g.key} style={{ flex: g.share, background: g.key === 'Women' ? 'var(--louisiana)' : g.key === 'Men' ? 'var(--hawaiian)' : 'var(--line-2)' }} />)}
              </div>
              <div className="legend">{tt.gender.map((g) => <span key={g.key}><i style={{ background: g.key === 'Women' ? 'var(--louisiana)' : g.key === 'Men' ? 'var(--hawaiian)' : 'var(--line-2)' }} />{g.key} {pct(g.share, 0)}</span>)}</div>
              <h4 className="sub-h">Age</h4>
              <div style={{ display: 'grid', gap: 7 }}>
                {tt.ages.map((a) => <Bar key={a.key} label={a.key} share={a.share / Math.max(...tt.ages.map((x) => x.share))} colour="var(--opal)" value={pct(a.share, 0)} />)}
              </div>
              <h4 className="sub-h">Where they are</h4>
              <div style={{ display: 'grid', gap: 7 }}>
                {tt.countries.map((c) => <Bar key={c.key} label={regionName(c.key)} share={c.share / (tt.countries[0]?.share || 1)} colour={c.key === 'GB' || c.key === 'IE' ? 'var(--opal)' : 'var(--line-2)'} value={pct(c.share, 0)} />)}
              </div>
              {tt.countries.length > 0 && <p className="note" style={{ marginTop: 10 }}>{pct(tt.countries.filter((c) => c.key === 'GB' || c.key === 'IE').reduce((s, c) => s + c.share, 0), 0)} of TikTok followers are in the UK or Ireland. The rest can&apos;t walk into a store, so read TikTok reach with that in mind.</p>}
            </div>
          </div>
          <p className="note">Instagram gives counts for followers of the account; TikTok gives percentage shares. These describe who follows us, not everyone a post reaches.</p>
        </div>
      </section>

      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Internal. Comments, totals and demographics from Instagram and TikTok via Windsor.ai, synced daily. Sentiment and flavour tags are keyword rules. Unprompted mentions come from the 07:47 morning report, which searches TikTok, Reddit, reviews, press and X.</p></div>
      </footer>
    </main>
  );
}

function CommentTile({ c }: { c: Comment }) {
  const s = sentimentOf(c.text);
  const href = safeHref(c.post_link);
  return (
    <div className="cmt" style={{ borderLeft: `3px solid ${SENT_COLOUR[s]}` }}>
      <div className="text">{c.text}</div>
      <div className="meta">
        <span className="likes-n">{int(c.likes)}</span> likes
        <span className="plat"><i style={{ background: CHANNEL_COLOUR[c.platform] }} />{c.platform}</span>
        <span className="tag" data-t={c.theme}>{c.theme}</span>
        {c.author && <span>@{c.author}</span>}
        {href && <a href={href} target="_blank" rel="noopener noreferrer">Post</a>}
      </div>
    </div>
  );
}

function FlavourCard({ f, rank, total }: { f: FlavourScore; rank: number; total: number }) {
  const net = f.net ?? 0;
  return (
    <article className="flav" style={{ ['--fc' as string]: f.colour }}>
      <div className="fhead">
        <span className="rankn">{rank}</span>
        <div style={{ minWidth: 0 }}>
          <div className="fname">{f.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {f.lto && <span className="badge">LTO</span>}
            <span className="muted" style={{ fontSize: '.78rem' }}>{f.mentions ? `${int(f.mentions)} mentions · ${total ? pct(f.mentions / total, 0) : '—'} of chat` : 'Not mentioned yet'}</span>
          </div>
        </div>
      </div>
      <div className="meter" aria-label={`Net sentiment ${f.net == null ? 'none' : Math.round(net * 100)}`}>
        <span className="mid" />
        {f.net != null && <span className="fill" style={{ left: net >= 0 ? '50%' : `${50 + net * 50}%`, width: `${Math.abs(net) * 50}%`, background: net >= 0 ? 'var(--opal)' : 'var(--atomic)' }} />}
      </div>
      <div className="fstats">
        <span><b className="up">{f.positive}</b> love</span>
        <span><b className="down">{f.negative}</b> pushback</span>
        <span><b>{f.mixed}</b> mixed</span>
        <span><b>{compact(f.likes)}</b> likes</span>
        <span><b>{f.unprompted}</b> unprompted</span>
      </div>
      {f.top && <p className="fquote">&ldquo;{f.top.text.slice(0, 140)}{f.top.text.length > 140 ? '…' : ''}&rdquo; <span className="muted">· {int(f.top.likes)} likes</span></p>}
    </article>
  );
}

function MentionCard({ m }: { m: Mention }) {
  const href = safeHref(m.url);
  const s = sentimentOf(`${m.title} ${m.summary ?? ''}`);
  return (
    <article className="item" data-p={m.priority ?? 'none'}>
      <div className="row" style={{ alignItems: 'center' }}>
        <span className="brand">{m.source}{m.author ? ` · ${m.author}` : ''}</span>
        <span style={{ display: 'flex', gap: 6 }}>{m.kind && <span className="act kind">{m.kind}</span>}{m.action && <span className="act" data-a={m.action}>{m.action}</span>}</span>
      </div>
      <div className="title">{m.title}</div>
      {m.summary && <div className="sum">{m.summary}</div>}
      {m.metric && <div className="muted" style={{ fontSize: '.82rem' }}>{m.metric}</div>}
      <div className="foot"><span style={{ color: SENT_COLOUR[s] === 'var(--line-2)' ? undefined : SENT_COLOUR[s] }}>{s}</span><span>{day(m.posted_on)}</span>{href && <a href={href} target="_blank" rel="noopener noreferrer">Open</a>}</div>
    </article>
  );
}
