import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './index.js';

describe('turso MCP server', () => {
  beforeEach(() => {
    process.env.TURSO_API_TOKEN = 'test-token';
    process.env.TURSO_ORG_SLUG = 'acme';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TURSO_API_TOKEN;
    delete process.env.TURSO_ORG_SLUG;
  });

  async function connectClient() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return { client, server };
  }

  it('lists all four expected tools', async () => {
    const { client } = await connectClient();
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(['get_database', 'get_database_usage', 'list_databases', 'list_groups']);
  });

  it('list_databases returns the MCP text-content envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          databases: [
            {
              Name: 'prod',
              DbId: 'db-1',
              Hostname: 'prod.turso.io',
              regions: ['iad'],
              primaryRegion: 'iad',
              group: 'default',
              block_reads: false,
              block_writes: false,
              delete_protection: true,
              parent: null,
            },
          ],
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'list_databases', arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe('text');
    const parsed = JSON.parse(content[0]!.text) as Array<{ Name: string }>;
    expect(parsed[0]!.Name).toBe('prod');
    const structured = result.structuredContent as {
      databases: Array<{ name: string; hostname?: string; region?: string }>;
    };
    expect(structured.databases[0]!.name).toBe('prod');
    expect(structured.databases[0]!.hostname).toBe('prod.turso.io');
  });
});
