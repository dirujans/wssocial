import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Founding-member hunt: shortlist, winner, or clear an entry. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isSignedIn('flavour')) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { status?: string | null; note?: string };
  if (b.status != null && !['shortlist', 'winner', 'skip'].includes(b.status)) return Response.json({ ok: false, error: 'Bad status' }, { status: 400 });
  const patch: Record<string, unknown> = { status: b.status ?? null, updated_at: new Date().toISOString() };
  if (typeof b.note === 'string') patch.note = b.note.slice(0, 300);
  const { error } = await supabaseAdmin().from('fc_entries').update(patch).eq('id', decodeURIComponent(params.id));
  return Response.json({ ok: !error, error: error?.message }, { status: error ? 500 : 200 });
}
