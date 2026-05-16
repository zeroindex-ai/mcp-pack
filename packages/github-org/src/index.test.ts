import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './index.js';

describe('github-org MCP server', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  async function connectClient() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return { client, server };
  }

  it('lists all five expected tools with descriptions', async () => {
    const { client } = await connectClient();
    const result = await client.listTools();
    const byName = new Map(result.tools.map((t) => [t.name, t]));

    expect([...byName.keys()].sort()).toEqual([
      'get_authenticated_user',
      'list_issues',
      'list_org_repos',
      'list_pull_requests',
      'list_workflow_runs',
    ]);
    expect(byName.get('list_issues')?.description).toMatch(/Pull requests are excluded/);
  });

  it('get_authenticated_user returns the MCP text-content envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ login: 'abhi', id: 42, public_repos: 7 }))
    );
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'get_authenticated_user', arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    expect(content[0]!.type).toBe('text');
    const parsed = JSON.parse(content[0]!.text) as { login: string; id: number };
    expect(parsed.login).toBe('abhi');
    expect(parsed.id).toBe(42);
    const structured = result.structuredContent as { login: string; id: number };
    expect(structured.login).toBe('abhi');
    expect(structured.id).toBe(42);
  });
});
