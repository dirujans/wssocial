import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Team verdict on an inspo item (a trend, a comment): ours | skip | used | clear. */
export async function POST(req: Request) {
  if (!isSignedIn()) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { key?: string; verdict?: string; note?: string };
  if (!b.key || !/^(tag|comment|mention):/.test(b.key)) return Response.json({ ok: false, error: 'Bad key' }, { status: 400 });
  const db = supabaseAdmin();
  if (b.verdict === 'clear') { const { error } = await db.from('inspo_marks').delete().eq('key', b.key); return Response.json({ ok: !error, error: error?.message }); }
  if (!['ours', 'skip', 'used'].includes(String(b.verdict))) return Response.json({ ok: false, error: 'Bad verdict' }, { status: 400 });
  const { error } = await db.from('inspo_marks').upsert({ key: b.key.slice(0, 200), verdict: b.verdict, note: b.note?.slice(0, 300) ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
