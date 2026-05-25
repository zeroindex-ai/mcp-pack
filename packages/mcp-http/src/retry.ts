// Retry helpers shared across vendor wrappers.
//
// Semantics: honour 429 always; honour 403 only when paired with
// x-ratelimit-remaining: 0 (GitHub's secondary-limit signal). Delay is read
// from Retry-After (both RFC 7231 forms: delta-seconds and HTTP-date), then
// x-ratelimit-reset, else a 1s default. Cap any computed delay at 60s so a
// misbehaving header can't stall us forever.

const MAX_DELAY_MS = 60_000;

export function shouldRetry(res: Response): boolean {
  if (res.status === 429) return true;
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') return true;
  return false;
}

export function retryDelayMs(res: Response, now: () => number = Date.now): number {
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter) {
    // Retry-After comes in two RFC 7231 forms: delta-seconds (an integer) or
    // an HTTP-date. Try numeric first, then fall back to a date parse.
    const trimmed = retryAfter.trim();
    const secs = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(secs) && secs >= 0) {
      return Math.min(secs * 1000, MAX_DELAY_MS);
    }
    const dateMs = Date.parse(trimmed);
    if (Number.isFinite(dateMs)) {
      return Math.min(Math.max(dateMs - now(), 0), MAX_DELAY_MS);
    }
    // Unparseable value: fall through to the rate-limit-reset / default path.
  }
  const reset = res.headers.get('x-ratelimit-reset');
  if (reset) {
    const resetMs = Number(reset) * 1000;
    if (Number.isFinite(resetMs)) {
      return Math.min(Math.max(resetMs - now(), 0), MAX_DELAY_MS);
    }
  }
  return 1000;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(t);
      reject(signal!.reason instanceof Error ? signal!.reason : new Error('aborted'));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
