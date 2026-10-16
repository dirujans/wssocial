import Audience from '@/components/Audience';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';
import { loadAudience } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Our audience · Wingstop UK&I Social' };

export default async function Page() {
  if (!isSignedIn()) redirect('/login');
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
  return <Audience data={data} today={today} now={now} />;
}
