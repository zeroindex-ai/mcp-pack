import { HttpError, type Auth, type Client, type ClientOptions, type RequestOptions } from './types.js';
import { shouldRetry, retryDelayMs, sleep } from './retry.js';

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>
): string {
  // Preserve full path under baseUrl: ensure baseUrl ends with /, strip a
  // leading / from path so URL() doesn't replace the baseUrl's path segment.
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBase);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function authHeaders(auth: Auth): Record<string, string> {
  if (auth.kind === 'bearer') return { Authorization: `Bearer ${auth.token}` };
  return {};
}

function mergeBody(
  auth: Auth,
  body: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (auth.kind === 'body') return { ...auth.fields, ...(body ?? {}) };
  return body;
}

export function createClient(opts: ClientOptions): Client {
  const { vendor, baseUrl, auth, defaultHeaders = {}, timeoutMs = 30_000, retryOn429 = true } = opts;

  return async function request<T>(req: RequestOptions): Promise<T> {
    const url = buildUrl(baseUrl, req.path, req.query);
    const method = req.method ?? 'GET';
    const effectiveBody = mergeBody(auth, req.body);
    // body-auth forces a body even on GETs the caller didn't pass one for;
    // POST is the only sensible method in that case (Porkbun).
    const hasBody = effectiveBody !== undefined;

    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...authHeaders(auth),
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(req.headers ?? {}),
    };

    // One deadline for the whole operation (fetch attempts + retry wait),
    // not per-attempt — so worst-case latency is bounded by timeoutMs and the
    // retry sleep is cancellable if the deadline fires while we're waiting.
    const deadline = AbortSignal.timeout(timeoutMs);

    const doFetch = (): Promise<Response> =>
      fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(effectiveBody) : undefined,
        signal: deadline,
      });

    let res = await doFetch();
    // Deliberate single retry (not an oversight): every caller here is a
    // read-only idempotent GET, so one retry safely covers a transient
    // rate-limit/429 blip without masking a sustained outage behind a retry storm.
    if (retryOn429 && shouldRetry(res)) {
      const delay = retryDelayMs(res);
      await sleep(delay, deadline);
      res = await doFetch();
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(vendor, req.path, res.status, text || res.statusText);
    }
    return (await res.json()) as T;
  };
}
