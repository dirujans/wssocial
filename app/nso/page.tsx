import Nso from '@/components/Nso';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';
import { loadNso } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NSO intelligence · Wingstop UK&I Social' };

export default async function Page() {
  if (!isSignedIn()) redirect('/login');
  let data;
  try { data = await loadNso(); } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[nso] load failed:', message);
    return <main className="shell"><div className="band"><div className="inner"><h1>NSO intelligence</h1><div className="alert" data-sev="critical"><div><strong>The page couldn&apos;t load its data</strong><p>{message}</p></div></div></div></div></main>;
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return <Nso data={data} today={today} />;
}
