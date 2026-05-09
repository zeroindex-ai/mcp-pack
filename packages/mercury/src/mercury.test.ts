import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mg } from './mercury.js';

describe('mg', () => {
  beforeEach(() => {
    process.env.MERCURY_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MERCURY_API_TOKEN;
  });

  it('GETs the right URL with Bearer auth header', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ accounts: [] })));

    await mg('/accounts');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0]!;
    expect(String(call[0])).toBe('https://api.mercury.com/api/v1/accounts');
    expect(call[1]?.method).toBe('GET');
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-token');
    expect(headers.accept).toBe('application/json');
  });

  it('serializes query params and skips undefined values', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ total: 0, transactions: [] })));

    await mg('/account/abc/transactions', {
      start: '2026-01-01',
      end: undefined,
      limit: 50,
    });

    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('start=2026-01-01');
    expect(url).toContain('limit=50');
    expect(url).not.toContain('end=');
  });

  it('throws on transport-level HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unauthorized', { status: 401 }));
    await expect(mg('/accounts')).rejects.toThrow(/HTTP 401/);
  });

  it('includes response body in error message when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad token', { status: 403 })
    );
    await expect(mg('/accounts')).rejects.toThrow(/bad token/);
  });

  it('throws when MERCURY_API_TOKEN is missing', async () => {
    delete process.env.MERCURY_API_TOKEN;
    await expect(mg('/accounts')).rejects.toThrow(/MERCURY_API_TOKEN/);
  });
});
