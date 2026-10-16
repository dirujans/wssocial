import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Shortlist toggle or notes. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isSignedIn()) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { shortlisted?: boolean; notes?: string };
  const patch: Record<string, unknown> = {};
  if (typeof b.shortlisted === 'boolean') patch.shortlisted = b.shortlisted;
  if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 500);
  const { error } = await supabaseAdmin().from('nso_creators').update(patch).eq('id', params.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isSignedIn()) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const { error } = await supabaseAdmin().from('nso_creators').delete().eq('id', params.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
