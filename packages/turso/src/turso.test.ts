import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tg } from './turso.js';

describe('tg', () => {
  beforeEach(() => {
    process.env.TURSO_API_TOKEN = 'test-token';
    process.env.TURSO_ORG_SLUG = 'acme';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TURSO_API_TOKEN;
    delete process.env.TURSO_ORG_SLUG;
  });

  it('GETs the org-scoped URL with Bearer auth header', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ databases: [] })));

    await tg('/databases');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0]!;
    expect(String(call[0])).toBe('https://api.turso.tech/v1/organizations/acme/databases');
    expect(call[1]?.method).toBe('GET');
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-token');
    expect(headers.accept).toBe('application/json');
  });

  it('serializes query params and skips undefined values', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ database: {} })));

    await tg('/databases/prod-app/usage', {
      from: '2026-05-01T00:00:00Z',
      to: undefined,
    });

    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('from=2026-05-01T00%3A00%3A00Z');
    expect(url).not.toContain('to=');
  });

  it('throws on transport-level HTTP error and includes body text', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('invalid token', { status: 401 }))
    );
    await expect(tg('/databases')).rejects.toThrow(/HTTP 401.*invalid token/);
  });

  it('throws on 404 with the response body forwarded into the error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'database not found' }), { status: 404 })
      )
    );
    await expect(tg('/databases/nope')).rejects.toThrow(/HTTP 404.*database not found/);
  });

  it('throws when TURSO_API_TOKEN is missing', async () => {
    delete process.env.TURSO_API_TOKEN;
    await expect(tg('/databases')).rejects.toThrow(/TURSO_API_TOKEN/);
  });

  it('throws when TURSO_ORG_SLUG is missing', async () => {
    delete process.env.TURSO_ORG_SLUG;
    await expect(tg('/databases')).rejects.toThrow(/TURSO_ORG_SLUG/);
  });
});
