import { describe, it, expect } from 'vitest';
import { shouldRetry, retryDelayMs, sleep } from './retry.js';

function res(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

describe('shouldRetry', () => {
  it('returns true on 429', () => {
    expect(shouldRetry(res(429))).toBe(true);
  });

  it('returns true on 403 with x-ratelimit-remaining: 0', () => {
    expect(shouldRetry(res(403, { 'x-ratelimit-remaining': '0' }))).toBe(true);
  });

  it('returns false on plain 403 without rate-limit headers', () => {
    expect(shouldRetry(res(403))).toBe(false);
  });

  it('returns false on 403 with remaining > 0', () => {
    expect(shouldRetry(res(403, { 'x-ratelimit-remaining': '15' }))).toBe(false);
  });

  it('returns false on 200', () => {
    expect(shouldRetry(res(200))).toBe(false);
  });

  it('returns false on 500', () => {
    expect(shouldRetry(res(500))).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('parses Retry-After seconds', () => {
    expect(retryDelayMs(res(429, { 'retry-after': '5' }))).toBe(5000);
  });

  it('parses Retry-After 0 as 0ms (no wait)', () => {
    expect(retryDelayMs(res(429, { 'retry-after': '0' }))).toBe(0);
  });

  it('clamps Retry-After at 60000ms', () => {
    expect(retryDelayMs(res(429, { 'retry-after': '600' }))).toBe(60_000);
  });

  it('parses x-ratelimit-reset relative to a fake now()', () => {
    const nowMs = 1_700_000_000_000;
    const resetEpochSec = (nowMs + 3000) / 1000;
    expect(retryDelayMs(res(403, { 'x-ratelimit-reset': String(resetEpochSec) }), () => nowMs)).toBe(3000);
  });

  it('clamps x-ratelimit-reset at 60000ms', () => {
    const nowMs = 1_700_000_000_000;
    const resetEpochSec = (nowMs + 600_000) / 1000;
    expect(retryDelayMs(res(403, { 'x-ratelimit-reset': String(resetEpochSec) }), () => nowMs)).toBe(60_000);
  });

  it('returns 0 when x-ratelimit-reset is in the past', () => {
    const nowMs = 1_700_000_000_000;
    const resetEpochSec = (nowMs - 5000) / 1000;
    expect(retryDelayMs(res(403, { 'x-ratelimit-reset': String(resetEpochSec) }), () => nowMs)).toBe(0);
  });

  it('defaults to 1000ms when no usable headers are present', () => {
    expect(retryDelayMs(res(429))).toBe(1000);
  });

  it('parses Retry-After as an HTTP-date relative to a fake now()', () => {
    const nowMs = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
    const future = new Date(nowMs + 4000).toUTCString();
    expect(retryDelayMs(res(429, { 'retry-after': future }), () => nowMs)).toBe(4000);
  });

  it('clamps an HTTP-date Retry-After at 60000ms', () => {
    const nowMs = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
    const future = new Date(nowMs + 600_000).toUTCString();
    expect(retryDelayMs(res(429, { 'retry-after': future }), () => nowMs)).toBe(60_000);
  });

  it('returns 0 when an HTTP-date Retry-After is in the past', () => {
    const nowMs = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
    const past = new Date(nowMs - 5000).toUTCString();
    expect(retryDelayMs(res(429, { 'retry-after': past }), () => nowMs)).toBe(0);
  });

  it('falls back to the default when Retry-After is a malformed value', () => {
    expect(retryDelayMs(res(429, { 'retry-after': 'not-a-date-or-number' }))).toBe(1000);
  });

  it('falls back to x-ratelimit-reset when Retry-After is malformed', () => {
    const nowMs = 1_700_000_000_000;
    const resetEpochSec = (nowMs + 2000) / 1000;
    expect(
      retryDelayMs(
        res(429, { 'retry-after': 'garbage', 'x-ratelimit-reset': String(resetEpochSec) }),
        () => nowMs
      )
    ).toBe(2000);
  });
});

describe('sleep', () => {
  it('resolves after the given delay when no signal is supplied', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });

  it('resolves after the given delay when the signal never aborts', async () => {
    await expect(sleep(1, AbortSignal.timeout(60_000))).resolves.toBeUndefined();
  });

  it('rejects immediately when the signal is already aborted, surfacing the abort reason', async () => {
    const controller = new AbortController();
    controller.abort(new Error('already gone'));
    await expect(sleep(1000, controller.signal)).rejects.toThrow('already gone');
  });

  it('rejects with the abort reason when the signal aborts mid-wait', async () => {
    const controller = new AbortController();
    const p = sleep(10_000, controller.signal);
    controller.abort(new Error('cancelled mid-wait'));
    await expect(p).rejects.toThrow('cancelled mid-wait');
  });

  it('rejects when a deadline AbortSignal.timeout fires during the wait', async () => {
    // 5ms deadline vs a 10s sleep: the deadline must win and reject.
    await expect(sleep(10_000, AbortSignal.timeout(5))).rejects.toThrow();
  });
});
