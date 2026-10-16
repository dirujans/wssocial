'use client';

import { useState } from 'react';
import type { CompetitorItem } from '@/lib/types';
import { day, safeHref } from './format';

export default function CompetitorPanel({ items }: { items: CompetitorItem[] }) {
  const [brand, setBrand] = useState<string>('all');
  const brands = [...new Set(items.map((i) => i.brand))];
  const rows = (brand === 'all' ? items : items.filter((i) => i.brand === brand))
    .slice().sort((a, b) => Number(!!b.spike) - Number(!!a.spike) || String(b.posted_on).localeCompare(String(a.posted_on)));
  const spikes = items.filter((i) => i.spike).length;

  return (
    <section className="band" id="competitors">
      <div className="inner">
        <div className="band-head">
          <div>
            <span className="eyebrow">UK chicken and QSR · last 30 days · {items.length} moves{spikes ? ` · ${spikes} spiking` : ''}</span>
            <h2>Competitor watch</h2>
          </div>
          <div className="seg" role="group" aria-label="Filter by brand">
            <button type="button" aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>All</button>
            {brands.map((b) => <button key={b} type="button" aria-pressed={brand === b} onClick={() => setBrand(b)}>{b}</button>)}
          </div>
        </div>
        <p className="note">From the daily competitor brief, which searches trade press, news and public social. Engagement figures appear only where a source states them.</p>
        {rows.length === 0 ? <p className="empty">Nothing logged yet. The morning competitor brief adds to this.</p> : (
          <div className="feed">
            {rows.map((c) => {
              const href = safeHref(c.url);
              return (
                <article key={c.id} className="item" data-p={c.spike ? 'high' : 'none'}>
                  <div className="row" style={{ alignItems: 'center' }}>
                    <span className="brand">{c.brand}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {c.spike && <span className="act spike">Spiking</span>}
                      {c.kind && <span className="act kind">{c.kind}</span>}
                    </span>
                  </div>
                  <div className="title">{c.title}</div>
                  {c.summary && <div className="sum">{c.summary}</div>}
                  {c.metric && <div className="muted" style={{ fontSize: '.82rem' }}>{c.metric}</div>}
                  {c.so_what && <div className="why">So what: {c.so_what}</div>}
                  <div className="foot"><span>{c.platform} · {day(c.posted_on)}</span>{href && <a href={href} target="_blank" rel="noopener noreferrer">Source</a>}</div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
