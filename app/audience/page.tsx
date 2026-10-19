import Audience from '@/components/Audience';
import { requireArea } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import { loadAudience } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Our audience · Wingstop UK&I Social' };

export default async function Page() {
  const areas = requireArea('social', '/audience');
  let data;
  try {
    data = await loadAudience();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[audience] load failed:', message);
    return (
      <main className="shell"><div className="band"><div className="inner">
        <h1>Our audience</h1>
        <div className="alert" data-sev="critical"><div><strong>The page couldn&apos;t load its data</strong><p>{message}</p></div></div>
      </div></div></main>
    );
  }
  const now = new Date().toISOString();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return <><TopBar areas={areas} /><Audience data={data} today={today} now={now} /></>;
}
