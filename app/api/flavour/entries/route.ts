import { isSignedIn } from '@/lib/auth';
import { runActor } from '@/lib/apify';
import { mapFcEntries, parseEntryLinks, TEAM_ADDED } from '@/lib/flavourClub';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Add founding-member entries by link. Instagram hides hashtag results from logged-out tools (only the single top post
 * comes back), so the team pastes links seen in tag notifications. Instagram links are read straight away
 * (apify/instagram-scraper on the post URL: a few seconds, a fraction of a cent); TikTok links are saved from the URL and
 * pick up their numbers when the hashtag hunt next sees them. Status and notes are never touched here.
 */
export async function POST(req: Request) {
  if (!isSignedIn('flavour')) return Response.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({})) as { links?: string };
  const links = parseEntryLinks(String(b.links ?? '').slice(0, 5000)).slice(0, 20);
  if (!links.length) return Response.json({ ok: false, error: 'Paste an Instagram post or reel link, or a TikTok video link' }, { status: 400 });
  const db = supabaseAdmin(); const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = []; const drop: string[] = []; const unread: string[] = [];

  const ig = links.filter((l) => l.platform === 'Instagram');
  if (ig.length) {
    let items: Record<string, unknown>[] = [];
    try { items = (await runActor<Record<string, unknown>>('apify/instagram-scraper', { directUrls: ig.map((l) => l.url), resultsType: 'posts', resultsLimit: 1, addParentData: false }, { waitSecs: 45, limit: 50 })).items; } catch { /* saved from the link below */ }
    const read = mapFcEntries(items, 'Instagram', { trusted: true });
    for (const l of ig) {
      const code = l.id.slice(3);
      const hit = read.find((r) => (r.url ?? '').includes(`/${code}/`));
      if (hit) { rows.push({ ...hit, hashtag: TEAM_ADDED, updated_at: now }); if (hit.id !== l.id) drop.push(l.id); }
      else { unread.push(l.url); rows.push({ id: l.id, platform: 'Instagram', url: l.url, hashtag: TEAM_ADDED, updated_at: now }); }
    }
  }
  for (const l of links.filter((x) => x.platform === 'TikTok')) rows.push({ id: l.id, platform: 'TikTok', url: l.url, author: l.author, hashtag: TEAM_ADDED, updated_at: now });

  // Don't blank numbers the hunt already holds for a TikTok entry.
  const { data: held } = await db.from('fc_entries').select('id').in('id', rows.map((r) => r.id as string));
  const have = new Set((held ?? []).map((h) => h.id as string));
  const fresh = rows.filter((r) => !(r.platform === 'TikTok' && have.has(r.id as string)));
  const tagOnly = rows.filter((r) => r.platform === 'TikTok' && have.has(r.id as string)).map((r) => r.id as string);
  if (fresh.length) { const { error } = await db.from('fc_entries').upsert(fresh, { onConflict: 'id' }); if (error) return Response.json({ ok: false, error: error.message }, { status: 500 }); }
  if (tagOnly.length) await db.from('fc_entries').update({ hashtag: TEAM_ADDED, updated_at: now }).in('id', tagOnly);
  if (drop.length) await db.from('fc_entries').delete().in('id', drop).is('status', null);

  const { data: entries } = await db.from('fc_entries').select('*').in('id', rows.map((r) => r.id as string));
  return Response.json({ ok: true, added: rows.length, unread, entries: entries ?? [] });
}
