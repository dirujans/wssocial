import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isSignedIn()) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { saved?: boolean };
  if (typeof b.saved !== 'boolean') return Response.json({ ok: false, error: 'saved is required' }, { status: 400 });
  const { error } = await supabaseAdmin().from('nso_pages').update({ saved: b.saved }).eq('id', decodeURIComponent(params.id));
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
