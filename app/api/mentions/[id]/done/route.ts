import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isSignedIn('social') && !isSignedIn('flavour')) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const { error } = await supabaseAdmin().from('mentions').update({ done: true }).eq('id', decodeURIComponent(params.id));
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
