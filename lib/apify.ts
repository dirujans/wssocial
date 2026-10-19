import 'server-only';
// Apify REST client. Token lives only in Vercel (APIFY_TOKEN) and travels as a header, never in a URL we log.

const BASE = 'https://api.apify.com/v2';

export interface ActorRun<T> { items: T[]; usd: number | null; status: string; runId: string | null; ms: number }

/** Start an actor, wait for it (up to waitSecs), then read its dataset. Throws with Apify's message on failure. */
export async function runActor<T = Record<string, unknown>>(actor: string, input: unknown, { waitSecs = 50, limit = 1000 } = {}): Promise<ActorRun<T>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set in Vercel');
  const t0 = Date.now();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await fetch(`${BASE}/acts/${actor.replace('/', '~')}/runs?waitForFinish=${waitSecs}`, { method: 'POST', headers, body: JSON.stringify(input), cache: 'no-store' });
  const body = await res.json().catch(() => ({})) as { data?: { id: string; status: string; defaultDatasetId: string; usageTotalUsd?: number }; error?: { message?: string } };
  if (!res.ok || !body.data) throw new Error(`Apify ${actor}: ${body.error?.message ?? `HTTP ${res.status}`}`);
  const run = body.data;
  const ds = await fetch(`${BASE}/datasets/${run.defaultDatasetId}/items?clean=true&limit=${limit}`, { headers, cache: 'no-store' });
  const items = ds.ok ? ((await ds.json()) as T[]) : [];
  return { items, usd: run.usageTotalUsd ?? null, status: run.status, runId: run.id, ms: Date.now() - t0 };
}
