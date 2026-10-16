export class HttpError extends Error {
  constructor(public status: number, public body: string, url: string) {
    super(`HTTP ${status} from ${url.replace(/api_key=[^&]+/, 'api_key=***')}: ${body.slice(0, 300)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with exponential backoff; honours Retry-After; fails fast on 4xx other than 429. */
export async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3, baseDelayMs = 1000): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, cache: 'no-store' });
      if (res.ok) return res;
      const body = await res.text();
      const err = new HttpError(res.status, body, url);
      if (res.status !== 429 && res.status < 500) throw err;
      lastErr = err;
      const ra = Number(res.headers.get('retry-after'));
      if (attempt < retries) await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : baseDelayMs * 2 ** attempt);
    } catch (err) {
      if (err instanceof HttpError && err.status !== 429 && err.status < 500) throw err;
      lastErr = err;
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastErr;
}
