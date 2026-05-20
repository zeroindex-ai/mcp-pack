import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './index.js';

describe('porkbun MCP server', () => {
  beforeEach(() => {
    process.env.PORKBUN_API_KEY = 'test-key';
    process.env.PORKBUN_SECRET_API_KEY = 'test-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PORKBUN_API_KEY;
    delete process.env.PORKBUN_SECRET_API_KEY;
  });

  async function connectClient() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return { client, server };
  }

  it('lists the expected tools with titles and descriptions', async () => {
    const { client } = await connectClient();
    const result = await client.listTools();
    const byName = new Map(result.tools.map((t) => [t.name, t]));

    expect([...byName.keys()].sort()).toEqual(['list_dns_records', 'list_domains', 'ping']);
    expect(byName.get('ping')?.description).toMatch(/Pings the Porkbun API/);
    expect(byName.get('list_domains')?.description).toMatch(/every domain/);
    expect(byName.get('list_dns_records')?.description).toMatch(/DNS record/);
  });

  it('returns the MCP text-content envelope when ping succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', yourIp: '203.0.113.5' }))
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'ping', arguments: {} });

    expect(result.content).toEqual([{ type: 'text', text: 'OK — your IP is 203.0.113.5' }]);
    expect(result.structuredContent).toEqual({ ok: true, yourIp: '203.0.113.5' });
  });

  it('list_domains returns the MCP text-content envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'SUCCESS',
          domains: [
            {
              domain: 'zeroindex.ai',
              status: 'ACTIVE',
              tld: 'ai',
              createDate: '2026-01-01 00:00:00',
              expireDate: '2027-01-01 00:00:00',
            },
          ],
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'list_domains', arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe('text');
    const structured = result.structuredContent as { domains: Array<{ domain: string }> };
    expect(structured.domains[0]!.domain).toBe('zeroindex.ai');
  });

  it('list_dns_records returns the MCP text-content envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'SUCCESS',
          records: [{ id: '123', name: 'www.zeroindex.ai', type: 'A', content: '203.0.113.5', ttl: '600' }],
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'list_dns_records',
      arguments: { domain: 'zeroindex.ai' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as { records: Array<{ id: string; type: string }> };
    expect(structured.records[0]!.id).toBe('123');
    expect(structured.records[0]!.type).toBe('A');
  });

  it('surfaces an HTTP error as an MCP tool error (isError) on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ERROR', message: 'Invalid API key' }), { status: 401 })
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'ping', arguments: {} });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/HTTP 401/);
  });
});
