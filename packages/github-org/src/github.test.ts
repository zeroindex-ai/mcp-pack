import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gh, filterOutPullRequests, workflowRunsPath, type Issue } from './github.js';

describe('gh', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it('GETs the right URL with Bearer auth and required headers', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ login: 'abhi', id: 1 })));

    await gh('/user');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0]!;
    expect(String(call[0])).toBe('https://api.github.com/user');
    expect(call[1]?.method).toBe('GET');
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-token');
    expect(headers.accept).toBe('application/vnd.github+json');
    expect(headers['x-github-api-version']).toBe('2022-11-28');
    expect(headers['user-agent']).toContain('mcp-github-org');
  });

  it('serializes query params and skips undefined values', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([])));

    await gh('/orgs/zeroindex-ai/repos', {
      type: 'all',
      sort: undefined,
      per_page: 30,
      page: 1,
    });

    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('type=all');
    expect(url).toContain('per_page=30');
    expect(url).toContain('page=1');
    expect(url).not.toContain('sort=');
  });

  it('throws on transport-level HTTP error with response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"message":"Bad credentials"}', { status: 401 })
    );
    await expect(gh('/user')).rejects.toThrow(/HTTP 401.*Bad credentials/);
  });

  it('handles 404 with statusText fallback when body is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 404, statusText: 'Not Found' })
    );
    await expect(gh('/repos/foo/bar')).rejects.toThrow(/HTTP 404/);
  });

  it('throws when GITHUB_TOKEN is missing', async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(gh('/user')).rejects.toThrow(/GITHUB_TOKEN/);
  });
});

describe('filterOutPullRequests', () => {
  const issue = (n: number, isPR: boolean): Issue => ({
    number: n,
    title: `#${n}`,
    state: 'open',
    user: { login: 'u' },
    labels: [],
    assignees: null,
    comments: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    html_url: `https://x/${n}`,
    ...(isPR ? { pull_request: { url: 'https://x' } } : {}),
  });

  it('removes entries whose pull_request field is present and truthy', () => {
    const result = filterOutPullRequests([issue(1, false), issue(2, true), issue(3, false)]);
    expect(result.map((i) => i.number)).toEqual([1, 3]);
  });

  it('returns an empty array when every entry is a PR', () => {
    expect(filterOutPullRequests([issue(1, true), issue(2, true)])).toEqual([]);
  });

  it('returns input unchanged when no entry has pull_request', () => {
    const items = [issue(1, false), issue(2, false)];
    expect(filterOutPullRequests(items)).toEqual(items);
  });
});

describe('workflowRunsPath', () => {
  it('returns the repo-wide path when no workflow is given', () => {
    expect(workflowRunsPath('zeroindex-ai', 'mcp-pack')).toBe(
      '/repos/zeroindex-ai/mcp-pack/actions/runs'
    );
  });

  it('returns the workflow-scoped path when a workflow file is given', () => {
    expect(workflowRunsPath('zeroindex-ai', 'mcp-pack', 'ci.yml')).toBe(
      '/repos/zeroindex-ai/mcp-pack/actions/workflows/ci.yml/runs'
    );
  });

  it('url-encodes owner, repo, and workflow segments', () => {
    expect(workflowRunsPath('my org', 'repo/with-slash', 'name with space.yml')).toBe(
      '/repos/my%20org/repo%2Fwith-slash/actions/workflows/name%20with%20space.yml/runs'
    );
  });
});
