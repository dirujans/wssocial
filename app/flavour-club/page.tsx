import FlavourClub from '@/components/FlavourClub';
import TopBar from '@/components/TopBar';
import { requireArea } from '@/lib/auth';
import { loadFlavourClub } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Flavour Club · Wingstop UK&I' };

export default async function Page() {
  const areas = requireArea('flavour', '/flavour-club');
  let data;
  try { data = await loadFlavourClub(); } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[flavour-club] load failed:', message);
    return <main className="shell"><div className="band"><div className="inner"><h1>Flavour Club</h1><div className="alert" data-sev="critical"><div><strong>The page couldn&apos;t load its data</strong><p>{message}</p></div></div></div></div></main>;
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return <><TopBar areas={areas} /><FlavourClub data={data} today={today} /></>;
}
