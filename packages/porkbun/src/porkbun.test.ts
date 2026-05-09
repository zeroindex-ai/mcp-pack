import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pb } from './porkbun.js';

describe('pb', () => {
  beforeEach(() => {
    process.env.PORKBUN_API_KEY = 'test-key';
    process.env.PORKBUN_SECRET_API_KEY = 'test-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PORKBUN_API_KEY;
    delete process.env.PORKBUN_SECRET_API_KEY;
  });

  it('POSTs JSON with credentials merged into body', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'SUCCESS', yourIp: '1.2.3.4' })));

    const out = await pb<{ status: string; yourIp: string }>('/ping');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0]!;
    expect(call[0]).toBe('https://api.porkbun.com/api/json/v3/ping');
    expect(call[1]?.method).toBe('POST');
    const body = JSON.parse(call[1]?.body as string);
    expect(body).toMatchObject({ apikey: 'test-key', secretapikey: 'test-secret' });
    expect(out).toMatchObject({ status: 'SUCCESS', yourIp: '1.2.3.4' });
  });

  it('merges extra body fields after credentials', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'SUCCESS', domains: [] })));

    await pb<{ status: string; domains: unknown[] }>('/domain/listAll', { start: '1000' });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string);
    expect(body).toEqual({ apikey: 'test-key', secretapikey: 'test-secret', start: '1000' });
  });

  it('throws on Porkbun-level non-SUCCESS status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ERROR', message: 'Invalid API key' }))
    );
    await expect(pb('/ping')).rejects.toThrow(/Invalid API key/);
  });

  it('throws on transport-level HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('forbidden', { status: 403 }));
    await expect(pb('/ping')).rejects.toThrow(/HTTP 403/);
  });

  it('throws when credentials are missing', async () => {
    delete process.env.PORKBUN_API_KEY;
    await expect(pb('/ping')).rejects.toThrow(/PORKBUN_API_KEY/);
  });
});
