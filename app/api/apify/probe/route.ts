// One-off probe: runs each Apify actor on a tiny input and reports the fields it returns and what the run cost,
// so we only schedule scrapers that return what we need and fit the free credit.
// Guarded by a single-use key stored in Supabase (ops_keys), not by the team password, so it can be run from tooling.
import { runActor } from '@/lib/apify';
import { abortRun, runApifyStep } from '@/lib/apifyJobs';
import { runSync } from '@/lib/sync';
import { supabaseAdmin } from '@/lib/supabase';
import { geocodeStores } from '@/lib/stores';
import { syncAds } from '@/lib/adsSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROBES: Record<string, { actor: string; input: unknown }> = {
  tiktok: { actor: 'clockworks/tiktok-scraper', input: { profiles: ['kfcuki'], resultsPerPage: 3, profileScrapeSections: ['videos'], profileSorting: 'latest', shouldDownloadVideos: false, shouldDownloadCovers: false } },
  instagram: { actor: 'apify/instagram-scraper', input: { directUrls: ['https://www.instagram.com/kfc_uki/'], resultsType: 'posts', resultsLimit: 3, addParentData: false } },
  trends: { actor: 'data_xplorer/tiktok-trends', input: { trendType: 'hashtags', countryCode: 'GB', hashtagPeriod: '7', maxItems: 5 } },
};

const shape = (o: unknown, depth = 0): unknown => {
  if (Array.isArray(o)) return o.length ? [shape(o[0], depth + 1)] : [];
  if (o && typeof o === 'object') return depth > 2 ? '{…}' : Object.fromEntries(Object.entries(o as Record<string, unknown>).slice(0, 60).map(([k, v]) => [k, shape(v, depth + 1)]));
  return typeof o === 'string' ? (o.length > 80 ? o.slice(0, 80) + '…' : o) : o;
};

const brief = (i: Record<string, unknown>) => {
  const a = (i.authorMeta ?? {}) as Record<string, unknown>;
  return { input: i.input, author: a.name ?? i.ownerUsername, nick: a.nickName ?? i.ownerFullName, fans: a.fans, verified: a.verified, plays: i.playCount ?? i.videoPlayCount ?? i.videoViewCount, likes: i.diggCount ?? i.likesCount, shares: i.shareCount, saves: i.collectCount, when: i.createTimeISO ?? i.timestamp, name: i.name ?? i.hashtagName ?? i.title, error: i.error ?? i.errorDescription };
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? '';
  const db = supabaseAdmin();
  const { data } = await db.from('ops_keys').select('key').eq('key', key).eq('purpose', 'apify-probe').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!key || !data) return new Response('Unauthorised', { status: 401 });

  const abort = url.searchParams.get('abort');
  if (abort) return Response.json(await abortRun(abort));
  const sp = url.searchParams.get('sync');
  if (sp === 'core' || sp === 'intel' || sp === 'all') { const t0 = Date.now(); const r = await runSync(sp); return Response.json({ ms: Date.now() - t0, ...r }); }
  const ads = url.searchParams.get('ads');
  if (ads && (/^last_\d+dT?$/.test(ads) || /^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(ads))) { const t0 = Date.now(); return Response.json({ ms: Date.now() - t0, ...(await syncAds(ads)), took: Date.now() - t0 }); }
  if (url.searchParams.get('geocode') === 'stores') return Response.json(await geocodeStores(Number(url.searchParams.get('max') ?? 40)));
  if (url.searchParams.get('run') === 'jobs') return Response.json(await runApifyStep());
  // Actor probes cost credit, so they only run when named explicitly (?only=tiktok,trends).
  const which = (url.searchParams.get('only') ?? '').split(',').filter((k) => PROBES[k]);
  if (!which.length) return Response.json({ error: 'Nothing to do. Use sync, run, ads, geocode, abort or only.' }, { status: 400 });
  const override = url.searchParams.get('input');
  const results = await Promise.allSettled(which.map((k) => runActor<Record<string, unknown>>(PROBES[k].actor, override && which.length === 1 ? JSON.parse(override) : PROBES[k].input, { waitSecs: 50, limit: 60 })));
  const out = Object.fromEntries(which.map((k, i) => {
    const r = results[i];
    return [k, r.status === 'fulfilled'
      ? { actor: PROBES[k].actor, status: r.value.status, usd: r.value.usd, ms: r.value.ms, count: r.value.items.length, sample: shape(r.value.items[0]), brief: r.value.items.slice(0, 60).map(brief) }
      : { actor: PROBES[k].actor, error: String((r as PromiseRejectedResult).reason?.message ?? r) }];
  }));
  return Response.json(out);
}
