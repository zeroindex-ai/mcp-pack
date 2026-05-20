import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from './createClient.js';
import { HttpError } from './types.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createClient — URL + query', () => {
  it('builds URL from baseUrl + path and serializes query, skipping undefined', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com/v1',
      auth: { kind: 'none' },
    });

    await client({ path: '/things', query: { a: '1', b: 2, c: undefined } });

    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('https://api.example.com/v1/things');
    expect(url).toContain('a=1');
    expect(url).toContain('b=2');
    expect(url).not.toContain('c=');
  });

  it('serializes boolean query values as "true"/"false"', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    await client({ path: '/things', query: { all: true, archived: false } });

    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('all=true');
    expect(url).toContain('archived=false');
  });

  it('preserves the baseUrl path segments (no replacement)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com/api/v3',
      auth: { kind: 'none' },
    });

    await client({ path: '/ping' });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe('https://api.example.com/api/v3/ping');
  });
});

describe('createClient — auth', () => {
  it('adds Authorization: Bearer for bearer auth', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'bearer', token: 'tok-123' },
    });

    await client({ path: '/x' });

    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-123');
  });

  it('merges body-auth fields into POST body and sets JSON content-type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'body', fields: { apikey: 'k', secretapikey: 's' } },
    });

    await client({ method: 'POST', path: '/p', body: { extra: 'val' } });

    const call = fetchSpy.mock.calls[0]!;
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(call[1]?.body as string);
    expect(body).toEqual({ apikey: 'k', secretapikey: 's', extra: 'val' });
  });

  it('sends body-auth credentials even when caller passes no body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'body', fields: { apikey: 'k', secretapikey: 's' } },
    });

    await client({ method: 'POST', path: '/p' });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
    expect(body).toEqual({ apikey: 'k', secretapikey: 's' });
  });

  it('does not add Authorization for auth.kind=none', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    await client({ path: '/x' });

    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('createClient — headers', () => {
  it('merges defaultHeaders + per-request headers + auth headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'bearer', token: 't' },
      defaultHeaders: { Accept: 'application/json', 'X-Api-Version': '2024' },
    });

    await client({ path: '/x', headers: { 'X-Trace': 'abc' } });

    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json');
    expect(headers['X-Api-Version']).toBe('2024');
    expect(headers.Authorization).toBe('Bearer t');
    expect(headers['X-Trace']).toBe('abc');
  });
});

describe('createClient — error handling', () => {
  it('throws HttpError on non-2xx response', async () => {
    // Return a fresh Response per call — Response bodies are single-use,
    // and these two calls each consume one.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('not found', { status: 404 }));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    await expect(client({ path: '/missing' })).rejects.toBeInstanceOf(HttpError);
    try {
      await client({ path: '/missing' });
    } catch (err) {
      const e = err as HttpError;
      expect(e.vendor).toBe('Test');
      expect(e.path).toBe('/missing');
      expect(e.status).toBe(404);
      expect(e.body).toContain('not found');
    }
  });

  it('falls back to statusText when body is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 500, statusText: 'Internal Server Error' })
    );
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    await expect(client({ path: '/boom' })).rejects.toThrow(/Internal Server Error/);
  });
});

describe('createClient — retry', () => {
  it('retries once on 429 and returns the second response on success', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('rl', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    const out = await client<{ ok: boolean }>({ path: '/x' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ ok: true });
  });

  it('propagates non-rate-limit 500 without retry', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    await expect(client({ path: '/x' })).rejects.toThrow(/HTTP 500/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('disables retry when retryOn429: false', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('rl', { status: 429, headers: { 'retry-after': '0' } }));
    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
      retryOn429: false,
    });

    await expect(client({ path: '/x' })).rejects.toThrow(/HTTP 429/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('passes a per-call deadline AbortSignal to fetch, reused across both attempts', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('rl', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
    });

    await client({ path: '/x' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const sig1 = fetchSpy.mock.calls[0]![1]?.signal;
    const sig2 = fetchSpy.mock.calls[1]![1]?.signal;
    expect(sig1).toBeInstanceOf(AbortSignal);
    // One deadline bounds the whole operation: same signal on every attempt.
    expect(sig1).toBe(sig2);
  });

  it('bounds the retry wait by the per-call deadline (rejects rather than waiting out a long delay)', async () => {
    // First response asks for a 60s retry wait; with a 20ms operation deadline,
    // the abortable sleep must reject well before that, bounding total latency.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('rl', { status: 429, headers: { 'retry-after': '60' } }))
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'none' },
      timeoutMs: 20,
    });

    await expect(client({ path: '/x' })).rejects.toThrow();
    // The retry fetch must never fire — we aborted during the wait.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries on 403 + x-ratelimit-remaining: 0', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('rl', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'retry-after': '0' },
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    const client = createClient({
      vendor: 'Test',
      baseUrl: 'https://api.example.com',
      auth: { kind: 'bearer', token: 't' },
    });

    await client({ path: '/x' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
