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
      const res = await fetch('/api/sync-now', { method: 'POST' });
      const r = await res.json();
      if (r.status === 'error') { setState('failed'); setMsg((r.errors ?? []).join(' · ') || 'Sync failed.'); return; }
      setState('done');
      setMsg(r.status === 'partial' ? `Partly synced: ${(r.errors ?? []).join(' · ')}` : `Synced ${r.posts ?? 0} posts and ${r.comments ?? 0} comments.`);
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
