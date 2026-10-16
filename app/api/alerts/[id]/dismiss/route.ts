import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Protected by the page password (middleware matches /api/alerts).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin().from('alerts').update({ dismissed: true }).eq('id', decodeURIComponent(params.id));
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
