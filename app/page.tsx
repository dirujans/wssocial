import Dashboard from '@/components/Dashboard';
import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';
import { loadDashboard } from '@/lib/data';

// Read fresh on each visit: the team is small and Supabase is quick.
// (Static build would also fail a deploy whenever Supabase is unreachable.)
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!isSignedIn()) redirect('/login');
  const data = await loadDashboard();
  return <Dashboard data={data} />;
}
