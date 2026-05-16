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
});
