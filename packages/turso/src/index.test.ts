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

  it('get_database returns the MCP text-content envelope with a normalised projection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          database: {
            Name: 'prod',
            DbId: 'db-1',
            Hostname: 'prod.turso.io',
            primaryRegion: 'iad',
            group: 'default',
          },
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'get_database', arguments: { name: 'prod' } });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      database: { name: string; hostname?: string; region?: string };
    };
    expect(structured.database.name).toBe('prod');
    expect(structured.database.hostname).toBe('prod.turso.io');
    expect(structured.database.region).toBe('iad');
  });

  it('get_database_usage projects the vendor total into structuredContent.usage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          database: {
            uuid: 'db-1',
            instances: [
              {
                uuid: 'inst-1',
                usage: { rows_read: 5, rows_written: 2, storage_bytes: 100, bytes_synced: 10 },
              },
            ],
            total: { rows_read: 5, rows_written: 2, storage_bytes: 100, bytes_synced: 10 },
          },
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'get_database_usage', arguments: { name: 'prod' } });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      usage: { rows_read?: number; storage_bytes?: number };
    };
    expect(structured.usage.rows_read).toBe(5);
    expect(structured.usage.storage_bytes).toBe(100);
  });

  it('list_groups returns the MCP text-content envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          groups: [
            {
              name: 'default',
              version: 'v0.24',
              uuid: 'grp-1',
              locations: ['iad', 'lhr'],
              primary: 'iad',
              delete_protection: false,
            },
          ],
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'list_groups', arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      groups: Array<{ name: string; primary?: string; locations?: string[] }>;
    };
    expect(structured.groups[0]!.name).toBe('default');
    expect(structured.groups[0]!.primary).toBe('iad');
    expect(structured.groups[0]!.locations).toEqual(['iad', 'lhr']);
  });

  it('surfaces an HTTP error as an MCP tool error (isError) on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'get_database', arguments: { name: 'missing' } });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/HTTP 404/);
  });
});
