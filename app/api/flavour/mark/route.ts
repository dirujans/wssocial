import { isSignedIn } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Flavour Club marks: a question answered, an opportunity done. */
export async function POST(req: Request) {
  if (!isSignedIn('flavour')) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { key?: string; verdict?: string };
  if (!b.key || !/^(comment|opp|mention):/.test(b.key)) return Response.json({ ok: false, error: 'Bad key' }, { status: 400 });
  const db = supabaseAdmin();
  if (b.verdict === 'clear') { const { error } = await db.from('fc_marks').delete().eq('key', b.key); return Response.json({ ok: !error, error: error?.message }); }
  if (!['answered', 'done'].includes(String(b.verdict))) return Response.json({ ok: false, error: 'Bad verdict' }, { status: 400 });
  const { error } = await db.from('fc_marks').upsert({ key: b.key.slice(0, 200), verdict: b.verdict, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return Response.json({ ok: !error, error: error?.message }, { status: error ? 500 : 200 });
}
