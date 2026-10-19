import Inspo from '@/components/Inspo';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';
import { loadInspo } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inspo · Wingstop UK&I Social' };

export default async function Page() {
  if (!isSignedIn()) redirect('/login');
  let data;
  try { data = await loadInspo(); } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[inspo] load failed:', message);
    return <main className="shell"><div className="band"><div className="inner"><h1>Inspo</h1><div className="alert" data-sev="critical"><div><strong>The page couldn&apos;t load its data</strong><p>{message}</p></div></div></div></div></main>;
  }
  return <Inspo data={data} />;
}
