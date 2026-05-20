// Retry helpers shared across vendor wrappers.
//
// Semantics: honour 429 always; honour 403 only when paired with
// x-ratelimit-remaining: 0 (GitHub's secondary-limit signal). Cap any
// computed delay at 60s so a misbehaving header can't stall us forever.

const MAX_DELAY_MS = 60_000;

export function shouldRetry(res: Response): boolean {
  if (res.status === 429) return true;
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') return true;
  return false;
}

export function retryDelayMs(res: Response, now: () => number = Date.now): number {
  const retryAfter = res.headers.get('retry-after');
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, MAX_DELAY_MS);
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
