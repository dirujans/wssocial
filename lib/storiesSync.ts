import 'server-only';
import { supabaseAdmin } from './supabase';
import { fetchStories } from './windsor';

/**
 * Upsert the Stories that are live right now. Run several times a day: Instagram drops a Story's stats 24 hours after it
 * goes up, so the last reading taken before then is the one that stays. A thumbnail, once seen, is never blanked.
 */
export async function syncStories(): Promise<{ live: number }> {
  const stories = await fetchStories();
  if (!stories.length) return { live: 0 };
  const now = new Date().toISOString();
  const db = supabaseAdmin();
  const withThumb = stories.filter((s) => s.thumb_url).map((s) => ({ ...s, updated_at: now }));
  const noThumb = stories.filter((s) => !s.thumb_url).map(({ thumb_url: _t, ...s }) => ({ ...s, updated_at: now }));
  for (const batch of [withThumb, noThumb]) {
    if (!batch.length) continue;
    const { error } = await db.from('ig_stories').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`ig_stories: ${error.message}`);
  }
  return { live: stories.length };
}
