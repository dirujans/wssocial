import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Add or update an opening. */
export async function POST(req: Request) {
  if (!isSignedIn('nso')) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => null) as Record<string, string | null> | null;
  if (!b?.store || !b?.city) return Response.json({ ok: false, error: 'Store and city are required' }, { status: 400 });
  const row = {
    id: b.id || slug(`${b.city} ${b.store}`), store: String(b.store).slice(0, 120), city: String(b.city).slice(0, 60),
    city_match: (b.city_match || b.city) as string, region: b.region || null, address: b.address || null,
    opens_on: b.opens_on && /^\d{4}-\d{2}-\d{2}$/.test(b.opens_on) ? b.opens_on : null,
    status: ['open', 'announced', 'planned'].includes(String(b.status)) ? b.status : 'planned', notes: b.notes || null,
  };
  const { error } = await supabaseAdmin().from('nso_openings').upsert(row, { onConflict: 'id' });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: row.id });
}
