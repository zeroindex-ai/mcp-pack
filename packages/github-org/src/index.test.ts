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

  it('list_org_repos returns the MCP text-content envelope with a trimmed projection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: 'mcp-pack',
            full_name: 'zeroindex-ai/mcp-pack',
            private: true,
            description: 'MCP server pack',
          },
        ])
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'list_org_repos',
      arguments: { org: 'zeroindex-ai' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      repos: Array<{ name: string; full_name: string; private: boolean }>;
    };
    expect(structured.repos[0]!.name).toBe('mcp-pack');
    expect(structured.repos[0]!.full_name).toBe('zeroindex-ai/mcp-pack');
    expect(structured.repos[0]!.private).toBe(true);
  });

  it('list_pull_requests returns the MCP text-content envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([{ number: 7, title: 'Wire abort signal', state: 'open', user: { login: 'abhi' } }])
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'list_pull_requests',
      arguments: { owner: 'zeroindex-ai', repo: 'mcp-pack' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      pull_requests: Array<{ number: number; title: string; user?: string }>;
    };
    expect(structured.pull_requests[0]!.number).toBe(7);
    expect(structured.pull_requests[0]!.user).toBe('abhi');
  });

  it('list_issues excludes pull requests from the results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          { number: 10, title: 'Real issue', state: 'open', user: { login: 'abhi' } },
          {
            number: 11,
            title: 'A PR masquerading as an issue',
            state: 'open',
            user: { login: 'abhi' },
            pull_request: { url: 'https://api.github.com/...' },
          },
        ])
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'list_issues',
      arguments: { owner: 'zeroindex-ai', repo: 'mcp-pack' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      issues: Array<{ number: number; title: string }>;
    };
    expect(structured.issues).toHaveLength(1);
    expect(structured.issues[0]!.number).toBe(10);
  });

  it('list_workflow_runs returns the MCP text-content envelope with a trimmed projection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          total_count: 1,
          workflow_runs: [
            {
              id: 99,
              name: 'CI',
              status: 'completed',
              conclusion: 'success',
              head_branch: 'main',
            },
          ],
        })
      )
    );
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'list_workflow_runs',
      arguments: { owner: 'zeroindex-ai', repo: 'mcp-pack', workflow: 'ci.yml' },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(1);
    const structured = result.structuredContent as {
      runs: Array<{ id: number; status: string; conclusion?: string | null; branch?: string }>;
    };
    expect(structured.runs[0]!.id).toBe(99);
    expect(structured.runs[0]!.conclusion).toBe('success');
    expect(structured.runs[0]!.branch).toBe('main');
  });

  it('surfaces an HTTP error as an MCP tool error (isError) on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad credentials', { status: 401 }));
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'get_authenticated_user', arguments: {} });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toMatch(/HTTP 401/);
  });
});
