import 'server-only';
// Scheduled Apify scrapes, driven by the daily sync (no extra crons, no public webhook):
// each sync first collects any finished runs and stores their results, then starts runs that are due.
// Runs finish in the background between the 02:45 and 05:30 syncs.
import { supabaseAdmin } from './supabase';
import { FC_HASHTAG, mapFcEntries } from './flavourClub';
import { mapTikTok, mapTrends, scoreTikTok, TIKTOK_HANDLES, type TikTokVideo } from './tiktok';

const BASE = 'https://api.apify.com/v2';
// Free plan budget is $5 a month. Costs seen: TikTok profiles ~$0.32 a run, trends ~$0.10 a run.
// Flavour Club hashtag hunts are the priority during the campaign, so competitor TikTok and trends run weekly.
const JOBS = {
  fc_tiktok: { actor: 'clockworks~tiktok-scraper', everyHours: 46, input: () => ({ hashtags: [FC_HASHTAG], resultsPerPage: 25, shouldDownloadVideos: false, shouldDownloadCovers: false }) },
  fc_instagram: { actor: 'apify~instagram-hashtag-scraper', everyHours: 46, input: () => ({ hashtags: [FC_HASHTAG], resultsLimit: 30 }) },
  tiktok: { actor: 'clockworks~tiktok-scraper', everyHours: 160, input: () => ({ profiles: TIKTOK_HANDLES, resultsPerPage: 12, profileScrapeSections: ['videos'], profileSorting: 'latest', excludePinnedPosts: true, shouldDownloadVideos: false, shouldDownloadCovers: false }) },
  trends: { actor: 'data_xplorer~tiktok-trends', everyHours: 160, input: () => ({ trendType: 'hashtags', countryCode: 'GB', hashtagPeriod: '7', maxItems: 40 }) },
} as const;
type Kind = keyof typeof JOBS;

const auth = () => ({ Authorization: `Bearer ${process.env.APIFY_TOKEN}`, 'Content-Type': 'application/json' });
const londonToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

async function ingest(kind: Kind, items: Record<string, unknown>[]) {
  const db = supabaseAdmin(); const today = londonToday();
  if (kind === 'fc_tiktok' || kind === 'fc_instagram') {
    // Status and notes (the team's founding-member shortlist) are not in these rows, so upserts never overwrite them.
    const rows = mapFcEntries(items, kind === 'fc_tiktok' ? 'TikTok' : 'Instagram').map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    if (rows.length) { const { error } = await db.from('fc_entries').upsert(rows, { onConflict: 'id' }); if (error) throw new Error(error.message); }
    return rows.length;
  }
  if (kind === 'trends') {
    const rows = mapTrends(items, today);
    if (rows.length) { const { error } = await db.from('tiktok_trends').upsert(rows, { onConflict: 'date,country,hashtag' }); if (error) throw new Error(error.message); }
    return rows.length;
  }
  const { videos, accounts } = mapTikTok(items, today);
  if (accounts.length) { const { error } = await db.from('competitor_tiktok_daily').upsert(accounts, { onConflict: 'date,handle' }); if (error) throw new Error(error.message); }
  // Re-score with history so each handle's "usual" uses everything we hold, not just this batch.
  const { data: held } = await db.from('competitor_tiktok').select('*').gte('posted', new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10));
  const merged = new Map<string, TikTokVideo>(((held ?? []) as TikTokVideo[]).map((v) => [v.id, v]));
  videos.forEach((v) => merged.set(v.id, v));
  const scored = scoreTikTok([...merged.values()]).map((v) => ({ ...v, updated_at: new Date().toISOString() }));
  if (scored.length) { const { error } = await db.from('competitor_tiktok').upsert(scored, { onConflict: 'id' }); if (error) throw new Error(error.message); }
  return videos.length;
}

export async function runApifyStep(): Promise<Record<string, unknown>> {
  if (!process.env.APIFY_TOKEN) return { skipped: 'APIFY_TOKEN not set' };
  const db = supabaseAdmin(); const out: Record<string, unknown> = {};
  // 1. Collect finished runs.
  const { data: open, error: oerr } = await db.from('apify_runs').select('*').is('ingested_at', null).order('started_at');
  if (oerr) out.collect_error = oerr.message;
  out.open_runs = (open ?? []).length;
  for (const r of open ?? []) {
    try {
      const res = await fetch(`${BASE}/actor-runs/${r.run_id}`, { headers: auth(), cache: 'no-store' });
      const raw = await res.json().catch(() => ({}));
      const run = raw.data as { status: string; defaultDatasetId: string; finishedAt?: string; usageTotalUsd?: number } | undefined;
      if (!run) { out[`${r.kind}_check_error`] = raw.error?.message ?? `HTTP ${res.status}`; continue; }
      if (['READY', 'RUNNING'].includes(run.status)) { out[`${r.kind}_pending`] = r.run_id; continue; }
      if (run.status !== 'SUCCEEDED') { await db.from('apify_runs').update({ status: run.status, finished_at: run.finishedAt ?? null, usd: run.usageTotalUsd ?? null, ingested_at: new Date().toISOString(), error: run.status }).eq('run_id', r.run_id); continue; }
      const ds = await fetch(`${BASE}/datasets/${run.defaultDatasetId}/items?clean=true&limit=2000`, { headers: auth(), cache: 'no-store' });
      const items = (await ds.json()) as Record<string, unknown>[];
      const n = await ingest(r.kind as Kind, items);
      await db.from('apify_runs').update({ status: run.status, finished_at: run.finishedAt ?? null, usd: run.usageTotalUsd ?? null, items: n, ingested_at: new Date().toISOString() }).eq('run_id', r.run_id);
      out[`${r.kind}_ingested`] = n;
    } catch (e) {
      await db.from('apify_runs').update({ error: String((e as Error).message).slice(0, 300) }).eq('run_id', r.run_id);
      out[`${r.kind}_error`] = String((e as Error).message);
    }
  }
  // 2. Start runs that are due (and not already running).
  for (const kind of Object.keys(JOBS) as Kind[]) {
    const job = JOBS[kind];
    // Never start a second run while one is open, and never start one if we can't tell.
    const { data: recent, error: qerr } = await db.from('apify_runs').select('started_at,ingested_at').eq('kind', kind).order('started_at', { ascending: false }).limit(5);
    if (qerr) { out[`${kind}_skip`] = qerr.message; continue; }
    const rows = recent ?? [];
    const pending = rows.some((x) => !x.ingested_at && Date.now() - Date.parse(x.started_at) < 6 * 3600e3);
    const due = !rows.length || Date.now() - Date.parse(rows[0].started_at) > job.everyHours * 3600e3;
    if (pending || !due) continue;
    const res = await fetch(`${BASE}/acts/${job.actor}/runs`, { method: 'POST', headers: auth(), body: JSON.stringify(job.input()), cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.data) { out[`${kind}_start_error`] = body.error?.message ?? `HTTP ${res.status}`; continue; }
    await db.from('apify_runs').insert({ run_id: body.data.id, kind, actor: job.actor, status: body.data.status, dataset_id: body.data.defaultDatasetId });
    out[`${kind}_started`] = body.data.id;
  }
  return out;
}

/** Abort a run we no longer want (e.g. an accidental duplicate) and close it off. */
export async function abortRun(runId: string) {
  const res = await fetch(`${BASE}/actor-runs/${runId}/abort`, { method: 'POST', headers: auth(), cache: 'no-store' });
  const raw = await res.json().catch(() => ({}));
  await supabaseAdmin().from('apify_runs').update({ status: raw.data?.status ?? 'ABORTED', ingested_at: new Date().toISOString(), error: 'aborted: duplicate' }).eq('run_id', runId);
  return { status: res.status, run: raw.data?.status ?? raw.error?.message };
}
