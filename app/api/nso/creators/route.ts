import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
const FIELDS = ['handle', 'name', 'platform', 'followers', 'followers_note', 'engagement_rate', 'age1824', 'age2534', 'female_pct', 'location_pct', 'fake_score', 'categories', 'email', 'competitor_history', 'why', 'source', 'source_url'] as const;

/** Add creators to an opening (one, or a whole CSV import). Existing handles are updated, shortlist status kept. */
export async function POST(req: Request) {
  if (!isSignedIn()) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => null) as { opening_id?: string; creators?: Record<string, unknown>[] } | null;
  if (!b?.opening_id || !Array.isArray(b.creators) || !b.creators.length) return Response.json({ ok: false, error: 'opening_id and creators are required' }, { status: 400 });
  if (b.creators.length > 500) return Response.json({ ok: false, error: 'Up to 500 at a time' }, { status: 400 });
  const rows = b.creators.filter((c) => typeof c.handle === 'string' && c.handle).map((c) => {
    const r: Record<string, unknown> = { opening_id: b.opening_id };
    FIELDS.forEach((f) => { if (c[f] !== undefined) r[f] = c[f]; });
    r.handle = String(c.handle).trim().slice(0, 80); r.platform = ['tiktok', 'instagram', 'youtube'].includes(String(c.platform)) ? c.platform : 'instagram';
    return r;
  });
  const { error } = await supabaseAdmin().from('nso_creators').upsert(rows, { onConflict: 'opening_id,handle,platform' });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, count: rows.length });
}
