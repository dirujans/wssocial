import 'server-only';
import { supabaseAdmin } from './supabase';
import { fetchAds } from './windsor';
import type { AdDay } from './paid';

/** Pull ads for a window and upsert them. Daily sync uses 7 days (late conversions and corrections land); backfill uses longer. */
export async function syncAds(datePreset = 'last_7dT'): Promise<{ meta: number; tiktok: number; spend: number }> {
  const { meta, tiktok } = await fetchAds(datePreset);
  const rows: (AdDay & { updated_at: string })[] = [...meta, ...tiktok].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const db = supabaseAdmin();
  for (let i = 0; i < rows.length; i += 800) {
    const { error } = await db.from('ads_daily').upsert(rows.slice(i, i + 800), { onConflict: 'day,platform,ad_id,placement' });
    if (error) throw new Error(`ads_daily: ${error.message}`);
  }
  return { meta: meta.length, tiktok: tiktok.length, spend: Math.round(rows.reduce((s, r) => s + r.spend, 0)) };
}
