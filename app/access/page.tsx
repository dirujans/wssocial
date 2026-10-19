import { redirect } from 'next/navigation';
import { isMasterSession, signedInAreas } from '@/lib/auth';
import { AREA_INFO } from '@/lib/areas';
import { supabaseAdmin } from '@/lib/supabase';
import TopBar from '@/components/TopBar';
import { LphFooter } from '@/components/Brand';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Access log · Wingstop UK&I' };

type Row = { id: number; at: string; ip_hash: string; area: string | null; granted: string[] | null; ok: boolean; device: string | null; outcome: string | null };
const label = (id: string | null) => AREA_INFO.find((a) => a.id === id)?.label ?? (id || 'Any');
const when = (t: string) => new Date(t).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' });

/** Who signed in, when, to what. Master-password sessions only. IPs are shown as a short hash ("connection"). */
export default async function Access() {
  if (!isMasterSession()) redirect('/login?next=/access');
  const { data, error } = await supabaseAdmin().from('auth_log').select('*').order('at', { ascending: false }).limit(300);
  const rows = (data ?? []) as Row[];
  const since = Date.now() - 7 * 864e5;
  const week = rows.filter((r) => Date.parse(r.at) >= since);
  const fails = week.filter((r) => !r.ok).length;
  return (
    <>
      <TopBar areas={signedInAreas()} />
      <main className="shell">
        <section className="band">
          <div className="inner">
            <div className="band-head"><div><span className="eyebrow">Master password only · last 300 attempts</span><h2>Access log</h2></div></div>
            {error && <p className="note" style={{ color: 'var(--bad)' }}>{error.message}</p>}
            <div className="small4">
              <div className="mini"><span className="eyebrow">Sign-ins, 7 days</span><div className="value">{week.filter((r) => r.ok).length}</div></div>
              <div className="mini"><span className="eyebrow">Connections, 7 days</span><div className="value">{new Set(week.filter((r) => r.ok).map((r) => r.ip_hash)).size}</div></div>
              <div className={`mini ${fails ? 'hot' : ''}`}><span className="eyebrow">Wrong passwords, 7 days</span><div className="value">{fails}</div></div>
              <div className="mini"><span className="eyebrow">Lockouts, 7 days</span><div className="value">{week.filter((r) => r.outcome === 'locked').length}</div></div>
            </div>
            <p className="note">A connection is a short code made from the network address, so the same office or phone shows the same code. Five wrong passwords in 15 minutes pause that connection for 15 minutes. Sessions last 7 days.</p>
            {rows.length === 0 ? <p className="empty">No sign-ins logged yet.</p> : (
              <div className="card tablewrap">
                <table>
                  <thead><tr><th>When</th><th>Result</th><th>Area asked for</th><th>Opened</th><th>Device</th><th>Connection</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={!r.ok ? { background: 'rgba(228,0,43,.08)' } : undefined}>
                        <td style={{ whiteSpace: 'nowrap' }}>{when(r.at)}</td>
                        <td>{r.ok ? (r.outcome === 'master password' ? 'Master' : 'Signed in') : r.outcome === 'locked' ? 'Locked out' : 'Wrong password'}</td>
                        <td>{label(r.area)}</td>
                        <td>{r.granted?.length ? (r.granted.length === 4 ? 'All areas' : r.granted.map(label).join(', ')) : 'None'}</td>
                        <td>{r.device ?? 'Unknown'}</td>
                        <td><code>{r.ip_hash.slice(0, 8)}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <LphFooter />
          </div>
        </section>
      </main>
    </>
  );
}
