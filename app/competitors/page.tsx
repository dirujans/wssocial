import Competitors from '@/components/Competitors';
import { requireArea } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import { loadCompetitors } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Competitor watch · Wingstop UK&I Social' };

export default async function Page() {
  const areas = requireArea('competitor', '/competitors');
  let data;
  try {
    data = await loadCompetitors();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[competitors] load failed:', message);
    return (
      <main className="shell"><div className="band"><div className="inner">
        <h1>Competitor watch</h1>
        <div className="alert" data-sev="critical"><div><strong>The page couldn&apos;t load its data</strong><p>{message}</p></div></div>
      </div></div></main>
    );
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return <><TopBar areas={areas} /><Competitors data={data} today={today} /></>;
}
