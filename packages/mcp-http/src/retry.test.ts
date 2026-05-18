import { describe, it, expect } from 'vitest';
import { shouldRetry, retryDelayMs } from './retry.js';

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

  it('falls through to default when Retry-After is non-numeric', () => {
    expect(retryDelayMs(res(429, { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }))).toBe(1000);
  });
});
