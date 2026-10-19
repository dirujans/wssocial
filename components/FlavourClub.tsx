'use client';

import { useMemo, useState } from 'react';
import type { FlavourClubData } from '@/lib/data';
import { classifyFc, FC_HASHTAG, FC_LAUNCH, FC_SITE, opportunities, type FcEntry, type FcTheme, type FcTopic } from '@/lib/flavourClub';
import CountUp from './CountUp';
import FcTraffic from './FcTraffic';
import PostWall from './PostWall';
import SectionNav from './SectionNav';
import SyncButton from './SyncButton';
import { CHANNEL_COLOUR, compact, day, int, pct, safeHref } from './format';

const THEME_COL: Record<FcTheme, string> = { Hyped: 'var(--opal)', Question: 'var(--lemon)', 'Wants in': 'var(--mango)', Pushback: 'var(--atomic)', 'Tagging a friend': 'var(--hawaiian)', Other: 'var(--line-2)' };
const THEMES: FcTheme[] = ['Hyped', 'Question', 'Wants in', 'Tagging a friend', 'Pushback', 'Other'];
const TOPICS: FcTopic[] = ['Sign-up', 'App and site', 'Stamps and rewards', 'Events and artists', 'Where', 'Founding member', 'Other question'];
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

async function post(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.error ?? 'Could not save');
}

export default function FlavourClub({ data, today }: { data: FlavourClubData; today: string }) {
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(data.marks.map((m) => [m.key, m.verdict])));
  const [entries, setEntries] = useState<FcEntry[]>(data.entries);
  const [topic, setTopic] = useState<FcTopic | 'all'>('all');
  const [showAnswered, setShowAnswered] = useState(false);
  const [entryFilter, setEntryFilter] = useState<'all' | 'shortlist' | 'winner'>('all');
  const [err, setErr] = useState<string | null>(null);

  const items = useMemo(() => data.comments.map(classifyFc), [data.comments]);
  const opps = useMemo(() => opportunities(items, entries.length), [items, entries.length]);
  const dayN = daysBetween(FC_LAUNCH, today) + 1;
  const sum = (k: 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'reach') => data.posts.reduce((s, p) => s + (p[k] ?? 0), 0);
  const opinion = items.filter((i) => i.sentiment !== 'neutral');
  const positive = opinion.length ? items.filter((i) => i.sentiment === 'positive').length / opinion.length : null;
  const questions = items.filter((i) => i.theme === 'Question');
  const open = questions.filter((i) => marks[`comment:${i.c.comment_id}`] !== 'answered');
  const qShown = questions.filter((i) => (topic === 'all' || i.topic === topic) && (showAnswered || marks[`comment:${i.c.comment_id}`] !== 'answered')).sort((a, b) => (b.c.likes ?? 0) - (a.c.likes ?? 0));
  const top = items.filter((i) => i.theme !== 'Pushback' && i.theme !== 'Tagging a friend' && i.c.text.replace(/@[\w.]+/g, '').trim().length > 4).sort((a, b) => (b.c.likes ?? 0) - (a.c.likes ?? 0)).slice(0, 9);
  const pushback = items.filter((i) => i.theme === 'Pushback').sort((a, b) => (b.c.likes ?? 0) - (a.c.likes ?? 0)).slice(0, 4);
  const shownEntries = entries.filter((e) => e.status !== 'skip' && (entryFilter === 'all' || e.status === entryFilter));

  const setMark = async (key: string, verdict: string) => {
    const before = marks[key];
    setMarks((s) => { const n = { ...s }; if (verdict === 'clear') delete n[key]; else n[key] = verdict; return n; });
    try { await post('/api/flavour/mark', 'POST', { key, verdict }); } catch (e) { setErr((e as Error).message); setMarks((s) => ({ ...s, [key]: before })); }
  };
  const setStatus = async (e: FcEntry, status: string | null) => {
    const before = e.status;
    setEntries((xs) => xs.map((x) => (x.id === e.id ? { ...x, status } : x)));
    try { await post(`/api/flavour/entries/${encodeURIComponent(e.id)}`, 'PATCH', { status }); } catch (er) { setErr((er as Error).message); setEntries((xs) => xs.map((x) => (x.id === e.id ? { ...x, status: before } : x))); }
  };

  return (
    <main className="shell fc">
      <header className="hero fc-hero">
        <div className="inner">
          <span className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>Wingstop Flavour Club · day {dayN} since launch · {day(FC_LAUNCH)}</span>
          <h1>Flavour Club</h1>
          <p className="take">
            {data.posts.length ? <><b>{compact(sum('views'))}</b> views and <b>{int(data.comments.length)}</b> comments on {data.posts.length} club post{data.posts.length === 1 ? '' : 's'}. </> : <>The launch post lands at the next sync. </>}
            {positive != null && <><b>{pct(positive, 0)}</b> of comments with an opinion are positive. </>}
            <b>{open.length}</b> questions waiting for an answer, <b>{entries.length}</b> #{FC_HASHTAG} posts found.
          </p>
          {data.lastSync && <p className="cap" style={{ color: 'rgba(255,255,255,.75)' }}>Last sync {new Date(data.lastSync.finished_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' })} · <a href={FC_SITE} target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>flavourclub.co.uk</a></p>}
        </div>
      </header>

      <nav className="filters" aria-label="Actions">
        <div className="inner">
          <span className="muted" style={{ fontSize: '.8rem' }}>Club posts are found by caption (Flavour Club, the hashtag, founding member). Entries refresh every two days.</span>
          <span style={{ marginLeft: 'auto' }}><SyncButton /></span>
        </div>
      </nav>
      {err && <section className="band" style={{ paddingTop: 12, paddingBottom: 12 }}><div className="inner"><p className="note" role="status" style={{ color: 'var(--atomic)' }}>{err}</p></div></section>}

      <section className="band" id="pulse">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">All club posts, Instagram and TikTok, since launch</span><h2>The pulse</h2></div></div>
          <div className="big3">
            {([['views', 'Views', 'How far the club announcement has travelled.'], ['shares', 'Shares', 'People sending the club to someone else: the best sign it lands.'], ['saves', 'Saves', 'People keeping it to come back to: intent to sign up.']] as const).map(([k, l, why], i) => (
              <article key={k} className={`big-card rise d${i + 1} ${i === 0 ? 'lead' : ''}`}>
                <span className="label">{l}</span>
                <div className="value"><CountUp value={sum(k)} format={(n) => compact(Math.round(n))} /></div>
                <div className="meta"><span className="split">{data.posts.slice(0, 3).map((p) => <span key={p.id}>{p.platform} {compact(p[k])}</span>)}</span></div>
                <p className="why-note">{why}</p>
              </article>
            ))}
          </div>
          <div className="small4">
            <div className="mini"><span className="eyebrow">Comments</span><div className="value"><CountUp value={data.comments.length} format={(n) => int(n)} /></div><div className="meta muted">captured on club posts</div></div>
            <div className="mini"><span className="eyebrow">Positive</span><div className="value">{positive != null ? pct(positive, 0) : '—'}</div><div className="meta muted">of comments with an opinion</div></div>
            <div className="mini hot"><span className="eyebrow">Open questions</span><div className="value"><CountUp value={open.length} format={(n) => int(n)} /></div><div className="meta muted">of {questions.length} asked</div></div>
            <div className="mini"><span className="eyebrow">#{FC_HASHTAG}</span><div className="value"><CountUp value={entries.length} format={(n) => int(n)} /></div><div className="meta muted">{entries.filter((e) => e.status === 'shortlist').length} shortlisted</div></div>
          </div>
        </div>
      </section>

      <FcTraffic rows={data.links} />

      <PostWall media={data.posts} comments={data.comments} from="2000-01-01" channel="All" id="club-posts" title="Club posts" eyebrow="Every post about Flavour Club · tap to play and read the comments" />

      <section className="band" id="conversation">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">{int(items.length)} comments on club posts</span><h2>What they&apos;re saying</h2></div></div>
          <div className="grid2">
            <div className="card">
              <h3>Why they comment</h3>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {THEMES.map((t) => { const n = items.filter((i) => i.theme === t).length; const max = Math.max(1, ...THEMES.map((x) => items.filter((i) => i.theme === x).length)); return (
                  <div key={t} className="hbar"><span className="lbl">{t}</span><span className="track"><span style={{ width: `${Math.max(0.5, (n / max) * 100)}%`, background: THEME_COL[t] }} /></span><span className="val">{int(n)}</span></div>
                ); })}
              </div>
              <p className="note" style={{ marginTop: 10 }}>Keyword rules, not AI: read the comments before quoting a number upward.</p>
            </div>
            <div className="card">
              <h3>What they ask about</h3>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {TOPICS.map((t) => { const n = questions.filter((i) => i.topic === t).length; const max = Math.max(1, ...TOPICS.map((x) => questions.filter((i) => i.topic === x).length)); return (
                  <div key={t} className="hbar"><span className="lbl">{t}</span><span className="track"><span style={{ width: `${Math.max(0.5, (n / max) * 100)}%`, background: 'var(--lemon)' }} /></span><span className="val">{int(n)}</span></div>
                ); })}
              </div>
            </div>
          </div>
          {top[0] && (
            <div className="spotlight">
              <span className="eyebrow" style={{ opacity: 0.7 }}>Loudest comment · {top[0].c.platform}</span>
              <div className="q" style={{ marginTop: 8 }}>&ldquo;{top[0].c.text}&rdquo;</div>
              <div className="meta"><span className="likes">{int(top[0].c.likes)}</span><span>likes</span>{safeHref(top[0].c.post_link) && <a href={safeHref(top[0].c.post_link)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>See the post</a>}</div>
            </div>
          )}
          <div className="cgrid">{top.slice(1).map((i) => <FcCommentTile key={i.c.comment_id} i={i} />)}</div>
          {pushback.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--atomic)' }}>
              <h3>Pushback worth reading</h3>
              <div className="cgrid" style={{ marginTop: 10 }}>{pushback.map((i) => <FcCommentTile key={i.c.comment_id} i={i} />)}</div>
            </div>
          )}
        </div>
      </section>

      <section className="band" id="questions">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">Most-liked first · mark answered so nobody doubles up</span><h2>Questions to answer</h2></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="seg" role="group" aria-label="Question topic">
                <button type="button" aria-pressed={topic === 'all'} onClick={() => setTopic('all')}>All<span className="count">{open.length}</span></button>
                {TOPICS.map((t) => { const n = open.filter((i) => i.topic === t).length; return n ? <button key={t} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}>{t}<span className="count">{n}</span></button> : null; })}
              </div>
              <button type="button" className="chip" aria-pressed={showAnswered} onClick={() => setShowAnswered((v) => !v)}>{showAnswered ? 'Hide answered' : 'Show answered'}</button>
            </div>
          </div>
          {qShown.length === 0 ? <p className="empty">{questions.length ? 'All caught up in this filter.' : 'No questions captured yet.'}</p> : (
            <div className="cgrid">
              {qShown.slice(0, 30).map((i) => {
                const key = `comment:${i.c.comment_id}`; const done = marks[key] === 'answered';
                return (
                  <div key={i.c.comment_id} className="cmt" style={{ opacity: done ? 0.45 : 1, borderLeft: '3px solid var(--lemon)' }}>
                    <div className="text">{i.c.text}</div>
                    <div className="meta">
                      <span className="likes-n">{int(i.c.likes)}</span> likes
                      <span className="plat"><i style={{ background: CHANNEL_COLOUR[i.c.platform] }} />{i.c.platform}</span>
                      {i.topic && <span className="tag" data-t="Where's ours?">{i.topic}</span>}
                      {i.c.author && <span>@{i.c.author}</span>}
                      {safeHref(i.c.post_link) && <a href={safeHref(i.c.post_link)} target="_blank" rel="noopener noreferrer">Reply on the post</a>}
                      <button type="button" className={`chip ${done ? 'primary' : ''}`} onClick={() => setMark(key, done ? 'clear' : 'answered')}>{done ? '✓ Answered' : 'Mark answered'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="opportunities">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Built from what people asked and said · tick off when done</span><h2>Opportunities</h2></div></div>
          {opps.length === 0 ? <p className="empty">Nothing stands out yet. This fills in as comments build.</p> : (
            <div className="feed">
              {opps.map((o) => { const key = `opp:${o.title}`; const done = marks[key] === 'done'; return (
                <article key={o.title} className="item" data-p={o.kind === 'fix' ? 'high' : o.kind === 'answer' ? 'medium' : 'low'} style={{ opacity: done ? 0.5 : 1 }}>
                  <div className="row" style={{ alignItems: 'center' }}><span className="act kind">{o.kind}</span><span className="muted" style={{ fontSize: '.8rem' }}>{o.count} signals</span></div>
                  <div className="title">{o.title}</div>
                  <div className="sum">{o.detail}</div>
                  <div className="foot"><button type="button" className={`chip ${done ? 'primary' : ''}`} onClick={() => setMark(key, done ? 'clear' : 'done')}>{done ? '✓ Done' : 'Mark done'}</button></div>
                </article>
              ); })}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="entries">
        <div className="inner">
          <div className="band-head">
            <div><span className="eyebrow">#{FC_HASHTAG} on TikTok and Instagram · the hunt for the founding member</span><h2>Entries</h2></div>
            <div className="seg" role="group" aria-label="Filter entries">
              {([['all', 'All'], ['shortlist', 'Shortlist'], ['winner', 'Winner']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={entryFilter === k} onClick={() => setEntryFilter(k)}>{l}<span className="count">{k === 'all' ? entries.filter((e) => e.status !== 'skip').length : entries.filter((e) => e.status === k).length}</span></button>)}
            </div>
          </div>
          <p className="note">Public posts using the hashtag, refreshed every two days (TikTok and Instagram via Apify). Private accounts and Stories can&apos;t be seen by any tool, so tell entrants to post publicly. Shortlist and winner are shared with everyone who can open this page.</p>
          {shownEntries.length === 0 ? <p className="empty">{entries.length ? 'Nothing in this filter.' : 'No public #wingstopflavourclub posts found yet. The first hashtag search runs at the next sync.'}</p> : (
            <div className="card tablewrap">
              <table>
                <thead><tr><th>Entry</th><th>When</th><th className="r">Plays</th><th className="r">Likes</th><th className="r">Comments</th><th /></tr></thead>
                <tbody>
                  {shownEntries.map((e) => (
                    <tr key={e.id} style={e.status === 'winner' ? { background: 'rgba(255,207,0,.18)' } : e.status === 'shortlist' ? { background: 'rgba(0,167,138,.12)' } : undefined}>
                      <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>
                        <span className="plat" style={{ marginRight: 6 }}><i style={{ background: e.platform === 'TikTok' ? 'var(--s1)' : 'var(--s2)' }} />{e.platform}</span>
                        {safeHref(e.url) ? <a href={safeHref(e.url)} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800 }}>@{e.author ?? 'unknown'}</a> : <b>@{e.author ?? 'unknown'}</b>}
                        {e.caption && <div className="muted" style={{ fontSize: '.78rem' }}>{e.caption.slice(0, 140)}</div>}
                      </td>
                      <td>{e.posted_at ? day(e.posted_at.slice(0, 10)) : '—'}</td>
                      <td className="r">{compact(e.plays)}</td>
                      <td className="r">{compact(e.likes)}</td>
                      <td className="r">{compact(e.comments)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className={`chip ${e.status === 'shortlist' ? 'primary' : ''}`} onClick={() => setStatus(e, e.status === 'shortlist' ? null : 'shortlist')}>{e.status === 'shortlist' ? '★ Shortlisted' : '☆ Shortlist'}</button>{' '}
                        <button type="button" className="chip" onClick={() => setStatus(e, e.status === 'winner' ? null : 'winner')}>{e.status === 'winner' ? '🏆 Winner' : 'Winner'}</button>{' '}
                        <button type="button" className="chip" onClick={() => setStatus(e, 'skip')} aria-label="Hide this entry">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="band" id="press">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Press, creators, Reddit, reviews · found by the morning report</span><h2>Press and online</h2></div></div>
          {data.mentions.length === 0 ? <p className="empty">No coverage logged yet. The 07:47 report now searches for Flavour Club every morning.</p> : (
            <div className="feed">
              {data.mentions.map((m) => (
                <article key={m.id} className="item" data-p={m.priority ?? 'none'}>
                  <div className="row" style={{ alignItems: 'center' }}><span className="brand">{m.source}{m.author ? ` · ${m.author}` : ''}</span><span style={{ display: 'flex', gap: 6 }}>{m.kind && <span className="act kind">{m.kind}</span>}{m.action && <span className="act" data-a={m.action}>{m.action}</span>}</span></div>
                  <div className="title">{m.title}</div>{m.summary && <div className="sum">{m.summary}</div>}
                  {m.metric && <div className="muted" style={{ fontSize: '.82rem' }}>{m.metric}</div>}
                  {m.why && <div className="why">{m.why}</div>}
                  <div className="foot"><span>{day(m.posted_on)}</span>{safeHref(m.url) && <a href={safeHref(m.url)} target="_blank" rel="noopener noreferrer">Open</a>}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="band" id="landscape">
        <div className="inner">
          <div className="band-head"><div><span className="eyebrow">Loyalty and app moves in UK chicken and QSR · last six months</span><h2>Loyalty landscape</h2></div></div>
          <p className="note">Context for reading our numbers, never a playbook to copy.</p>
          {data.loyalty.length === 0 ? <p className="empty">Nothing logged.</p> : (
            <div className="feed">
              {data.loyalty.slice(0, 9).map((c) => (
                <article key={c.id} className="item">
                  <div className="row" style={{ alignItems: 'center' }}><span className="brand">{c.brand}</span>{c.kind && <span className="act kind">{c.kind}</span>}</div>
                  <div className="title">{c.title}</div>{c.summary && <div className="sum">{c.summary}</div>}
                  {c.metric && <div className="muted" style={{ fontSize: '.82rem' }}>{c.metric}</div>}
                  <div className="foot"><span>{day(c.posted_on)}</span>{safeHref(c.url) && <a href={safeHref(c.url)} target="_blank" rel="noopener noreferrer">Source</a>}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <SectionNav sections={[{ id: 'pulse', label: 'The pulse' }, { id: 'traffic', label: 'Sign-up traffic' }, { id: 'club-posts', label: 'Club posts' }, { id: 'conversation', label: 'What they say' }, { id: 'questions', label: 'Questions' }, { id: 'opportunities', label: 'Opportunities' }, { id: 'entries', label: 'Entries' }, { id: 'press', label: 'Press and online' }, { id: 'landscape', label: 'Loyalty landscape' }]} />
      <footer className="band" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="inner"><p className="cap">Flavour Club only. Our posts and comments from Instagram and TikTok via Windsor.ai; hashtag entries via Apify; link clicks and QR scans via Bitly; press and chatter from the morning report. Themes and topics are keyword rules.</p></div>
      </footer>
    </main>
  );
}

function FcCommentTile({ i }: { i: ReturnType<typeof classifyFc> }) {
  return (
    <div className="cmt" style={{ borderLeft: `3px solid ${THEME_COL[i.theme]}` }}>
      <div className="text">{i.c.text}</div>
      <div className="meta">
        <span className="likes-n">{int(i.c.likes)}</span> likes
        <span className="plat"><i style={{ background: CHANNEL_COLOUR[i.c.platform] }} />{i.c.platform}</span>
        <span className="tag" style={{ background: THEME_COL[i.theme], borderColor: THEME_COL[i.theme], color: i.theme === 'Pushback' ? '#fff' : '#000' }}>{i.theme}</span>
        {i.c.author && <span>@{i.c.author}</span>}
        {safeHref(i.c.post_link) && <a href={safeHref(i.c.post_link)} target="_blank" rel="noopener noreferrer">Post</a>}
      </div>
    </div>
  );
}
