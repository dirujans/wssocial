import Dashboard from '@/components/Dashboard';
import { canView, requireArea } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import { loadDashboard } from '@/lib/data';

// Read fresh on each visit: the team is small and Supabase is quick.
// (Static build would also fail a deploy whenever Supabase is unreachable.)
export const dynamic = 'force-dynamic';

export default async function Page() {
  const areas = requireArea('social', '/social');
  let data;
  try {
    data = await loadDashboard();
  } catch (err) {
    // Shown only to signed-in team members, so the real cause is visible instead of a digest.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard] load failed:', message);
    return (
      <main className="shell"><div className="band"><div className="inner">
        <h1>Wingstop UK Social</h1>
        <div className="alert" data-sev="critical">
          <div>
            <strong>The dashboard couldn&apos;t load its data</strong>
            <p>{message}</p>
            <p>Usually a missing or wrong setting in Vercel (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY), or the database tables not being set up yet.</p>
          </div>
        </div>
      </div></div></main>
    );
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD, London
  // Spend stays behind the Paid password: without it, the money never reaches the browser.
  const showSpend = canView('paid');
  if (!showSpend) data = { ...data, adsByDay: data.adsByDay.map((r) => ({ ...r, ig_spend: 0, tt_spend: 0, spend: 0 })) };
  return <><TopBar areas={areas} /><Dashboard data={data} today={today} showSpend={showSpend} /></>;
}
