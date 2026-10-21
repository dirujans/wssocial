import 'server-only';
import { supabaseAdmin } from './supabase';
import { fetchAds, normLink } from './windsor';
import type { AdDay } from './paid';

/** Pull ads for a window and upsert them. Daily sync uses 7 days (late conversions and corrections land); backfill uses longer. */
export async function syncAds(datePreset = 'last_7dT'): Promise<{ meta: number; tiktok: number; spend: number }> {
  const { meta, tiktok } = await fetchAds(datePreset);
  const db = supabaseAdmin();
  // Boosts point at the organic post they came from: swap "ig_<media id>" for that post's key, so a boost and its post line up.
  const srcIds = [...new Set(meta.map((r) => r.post_key).filter((k): k is string => !!k && k.startsWith('ig_')))];
  const keyOf = new Map<string, string>();
  if (srcIds.length) {
    const { data, error } = await db.from('media').select('id,comment_key').in('id', srcIds);
    if (error) throw new Error(`media lookup: ${error.message}`);
    for (const m of (data ?? []) as { id: string; comment_key: string | null }[]) if (m.comment_key) keyOf.set(m.id, m.comment_key);
  }
  for (const r of meta) if (r.post_key?.startsWith('ig_')) r.post_key = keyOf.get(r.post_key) ?? (r.post_link ? normLink(r.post_link) : null);
  const rows: (AdDay & { updated_at: string })[] = [...meta, ...tiktok].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  for (let i = 0; i < rows.length; i += 800) {
    const { error } = await db.from('ads_daily').upsert(rows.slice(i, i + 800), { onConflict: 'day,platform,ad_id,placement' });
    if (error) throw new Error(`ads_daily: ${error.message}`);
  }
  return { meta: meta.length, tiktok: tiktok.length, spend: Math.round(rows.reduce((s, r) => s + r.spend, 0)) };
}
