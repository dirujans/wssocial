'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [msg, setMsg] = useState('');

  const run = async () => {
    setState('running'); setMsg('');
    try {
      // Two calls, so each half stays inside the 60s function limit.
      const call = async (part: string) => (await fetch(`/api/sync-now?part=${part}`, { method: 'POST' })).json();
      const r = await call('core');
      if (r.status === 'error') { setState('failed'); setMsg((r.errors ?? []).join(' · ') || 'Sync failed.'); return; }
      setMsg('Our channels done, now competitors and audience…');
      const i = await call('intel').catch(() => ({ status: 'error', errors: ['Competitor and audience sync timed out'] }));
      const errs = [...(r.errors ?? []), ...(i.errors ?? [])];
      setState('done');
      setMsg(errs.length ? `Partly synced: ${errs.join(' · ')}` : `Synced ${r.posts ?? 0} posts, ${r.comments ?? 0} comments and ${i.competitor_posts ?? 0} competitor posts.`);
      router.refresh();
    } catch {
      setState('failed'); setMsg('Could not reach the server. Try again in a moment.');
    }
  };

  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="chip" onClick={run} disabled={state === 'running'}>
        {state === 'running' ? 'Syncing… (up to a minute)' : 'Sync now'}
      </button>
      {msg && <span className="cap" role="status" style={{ margin: 0, color: state === 'failed' ? 'var(--bad)' : undefined }}>{msg}</span>}
    </span>
  );
}
