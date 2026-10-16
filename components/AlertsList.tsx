'use client';

import { useState } from 'react';
import type { Alert } from '@/lib/types';
import { ago, safeHref } from './format';

export default function AlertsList({ alerts }: { alerts: (Alert & { created_at: string })[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const rank = { critical: 0, warn: 1, info: 2 } as const;
  const open = alerts.filter((a) => !hidden.has(a.id)).sort((a, b) => rank[a.severity] - rank[b.severity]);
  const visible = all ? open : open.slice(0, 3);
  if (!open.length) return null;

  const dismiss = async (id: string) => {
    setHidden((s) => new Set(s).add(id));
    const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }).catch(() => null);
    if (!res?.ok) {
      setHidden((s) => { const n = new Set(s); n.delete(id); return n; });
      setError('Could not dismiss that alert. Try again in a moment.');
    }
  };

  return (
    <section className="alerts" aria-label="Alerts">
      {error && <p className="cap" role="status">{error}</p>}
      {visible.map((a) => (
        <div key={a.id} className="alert" data-sev={a.severity}>
          <div>
            <strong>{a.title}</strong>
            <p>{a.detail} {safeHref(a.link) && <a className="link" href={safeHref(a.link)} target="_blank" rel="noopener noreferrer">Open post</a>}</p>
            <p>{ago(a.created_at)}</p>
          </div>
          <button type="button" className="chip" onClick={() => dismiss(a.id)}>Dismiss</button>
        </div>
      ))}
      {open.length > 3 && (
        <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer alerts' : `Show ${open.length - 3} more ${open.length - 3 === 1 ? 'alert' : 'alerts'}`}
        </button>
      )}
    </section>
  );
}
