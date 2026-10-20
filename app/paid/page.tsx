import Paid from '@/components/Paid';
import { requireArea } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import { loadPaid } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Paid · Wingstop UK&I Social' };

export default async function Page() {
  const areas = requireArea('paid', '/paid');
  let data;
  try { data = await loadPaid(); } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[paid] load failed:', message);
    return <main className="shell"><div className="band"><div className="inner"><h1>Paid</h1><div className="alert" data-sev="critical"><div><strong>The page couldn&apos;t load its data</strong><p>{message}</p></div></div></div></div></main>;
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return <><TopBar areas={areas} /><Paid data={data} today={today} /></>;
}
