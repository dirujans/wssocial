'use client';

import { useState } from 'react';
import type { Mention } from '@/lib/types';
import { day, safeHref } from './format';

const ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const ACTIONS = ['escalate', 'reply', 'thank', 'engage', 'watch'];

export default function MentionsPanel({ mentions }: { mentions: Mention[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const open = mentions.filter((m) => !hidden.has(m.id));
  const counts = new Map<string, number>();
  open.forEach((m) => m.action && counts.set(m.action, (counts.get(m.action) ?? 0) + 1));
  const rows = (action === 'all' ? open : open.filter((m) => m.action === action))
    .slice().sort((a, b) => (ORDER[a.priority ?? 'low'] ?? 3) - (ORDER[b.priority ?? 'low'] ?? 3) || String(b.posted_on).localeCompare(String(a.posted_on)));

  const done = async (id: string) => {
    setHidden((s) => new Set(s).add(id));
    const res = await fetch(`/api/mentions/${encodeURIComponent(id)}/done`, { method: 'POST' }).catch(() => null);
    if (!res?.ok) { setHidden((s) => { const n = new Set(s); n.delete(id); return n; }); setError('Could not mark that as done. Try again in a moment.'); }
  };

  return (
    <section className="band" id="mentions">
      <div className="inner">
        <div className="band-head">
          <div>
            <span className="eyebrow">Tags, reviews, press and creators · refreshed each morning</span>
            <h2>Mentions to act on</h2>
          </div>
          <div className="seg" role="group" aria-label="Filter by action">
            <button type="button" aria-pressed={action === 'all'} onClick={() => setAction('all')}>All<span className="count">{open.length}</span></button>
            {ACTIONS.filter((a) => counts.get(a)).map((a) => (
              <button key={a} type="button" aria-pressed={action === a} onClick={() => setAction(a)}>{a}<span className="count">{counts.get(a)}</span></button>
            ))}
          </div>
        </div>
        <p className="note">Found by the daily social report searching the open web, so it will miss private and some platform-native tags. Mark an item done once handled and it drops off for everyone.</p>
        {error && <p className="cap" role="status">{error}</p>}
        {rows.length === 0 ? <p className="empty">Nothing waiting. New mentions arrive with the morning report.</p> : (
          <div className="feed">
            {rows.map((m) => {
              const href = safeHref(m.url);
              return (
                <article key={m.id} className="item" data-p={m.priority ?? 'low'}>
                  <div className="row" style={{ alignItems: 'center' }}>
                    <span className="act" data-a={m.action ?? 'watch'}>{m.action ?? 'watch'}</span>
                    <span className="muted" style={{ fontSize: '.78rem' }}>{m.source} · {day(m.posted_on)}</span>
                  </div>
                  <div className="title">{m.title}</div>
                  {m.summary && <div className="sum">{m.summary}</div>}
                  {m.why && <div className="why">{m.why}</div>}
                  <div className="foot">
                    <span>{m.author}</span>
                    {m.metric && <span>{m.metric}</span>}
                    {href && <a href={href} target="_blank" rel="noopener noreferrer">Open</a>}
                    <button type="button" className="chip" style={{ marginLeft: 'auto' }} onClick={() => done(m.id)}>Done</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
