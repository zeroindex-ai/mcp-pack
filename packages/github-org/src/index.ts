#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  gh,
  filterOutPullRequests,
  workflowRunsPath,
  type AuthenticatedUser,
  type Repo,
  type PullRequest,
  type Issue,
  type WorkflowRunsResponse,
} from './github.js';

const server = new McpServer({
  name: '@zeroindex-ai/mcp-github-org',
  version: '0.1.1',
});

server.registerTool(
  'get_authenticated_user',
  {
    title: 'Verify GitHub credentials',
    description:
      'Returns the authenticated user (token owner), plan info, and repo counts. Run this first to verify the token works and discover what scopes you have.',
    inputSchema: {},
  },
  async () => {
    const data = await gh<AuthenticatedUser>('/user');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'list_org_repos',
  {
    title: 'List repositories in an organization',
    description:
      'Returns repositories in the given GitHub organization. Filter by visibility/fork status and sort by created/updated/pushed/name.',
    inputSchema: {
      org: z.string().min(1).describe('The organization login, e.g. "zeroindex-ai".'),
      type: z
        .enum(['all', 'public', 'private', 'forks', 'sources', 'member'])
        .optional()
        .describe('Filter by repo type (default "all").'),
      sort: z
        .enum(['created', 'updated', 'pushed', 'full_name'])
        .optional()
        .describe('Sort order (default "created").'),
      per_page: z.number().int().min(1).max(100).optional().describe('Per-page (max 100).'),
      page: z.number().int().min(1).optional().describe('Page number (1-indexed).'),
    },
  },
  async ({ org, type, sort, per_page, page }) => {
    const data = await gh<Repo[]>(`/orgs/${encodeURIComponent(org)}/repos`, {
      type,
      sort,
      per_page,
      page,
    });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'list_pull_requests',
  {
    title: 'List pull requests for a repo',
    description: 'Returns pull requests for the given repo, filtered by state.',
    inputSchema: {
      owner: z.string().min(1).describe('Repo owner (user or org login).'),
      repo: z.string().min(1).describe('Repo name.'),
      state: z
        .enum(['open', 'closed', 'all'])
        .optional()
        .describe('PR state filter (default "open").'),
      per_page: z.number().int().min(1).max(100).optional(),
      page: z.number().int().min(1).optional(),
    },
  },
  async ({ owner, repo, state, per_page, page }) => {
    const data = await gh<PullRequest[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      { state, per_page, page }
    );
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'list_issues',
  {
    title: 'List issues for a repo',
    description:
      'Returns issues for the given repo, filtered by state. Pull requests are excluded — use list_pull_requests for those.',
    inputSchema: {
      owner: z.string().min(1).describe('Repo owner (user or org login).'),
      repo: z.string().min(1).describe('Repo name.'),
      state: z
        .enum(['open', 'closed', 'all'])
        .optional()
        .describe('Issue state filter (default "open").'),
      per_page: z.number().int().min(1).max(100).optional(),
      page: z.number().int().min(1).optional(),
    },
  },
  async ({ owner, repo, state, per_page, page }) => {
    const data = await gh<Issue[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      { state, per_page, page }
    );
    return { content: [{ type: 'text', text: JSON.stringify(filterOutPullRequests(data), null, 2) }] };
  }
);

server.registerTool(
  'list_workflow_runs',
  {
    title: 'List GitHub Actions workflow runs',
    description:
      'Returns recent workflow runs for a repo. Filter by workflow file (e.g. "ci.yml"), branch, event, or status. If workflow is omitted, lists runs across all workflows in the repo.',
    inputSchema: {
      owner: z.string().min(1).describe('Repo owner.'),
      repo: z.string().min(1).describe('Repo name.'),
      workflow: z
        .string()
        .optional()
        .describe('Workflow file name (e.g. "ci.yml") or numeric workflow ID.'),
      branch: z.string().optional().describe('Filter to runs on this branch.'),
      event: z
        .string()
        .optional()
        .describe('Filter by triggering event ("push", "pull_request", "schedule", "workflow_dispatch", ...).'),
      status: z
        .enum(['queued', 'in_progress', 'completed', 'success', 'failure', 'cancelled', 'skipped'])
        .optional()
        .describe('Filter by status (in-flight) or conclusion (completed).'),
      per_page: z.number().int().min(1).max(100).optional(),
      page: z.number().int().min(1).optional(),
    },
  },
  async ({ owner, repo, workflow, branch, event, status, per_page, page }) => {
    const data = await gh<WorkflowRunsResponse>(workflowRunsPath(owner, repo, workflow), {
      branch,
      event,
      status,
      per_page,
      page,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { total_count: data.total_count, count: data.workflow_runs.length, workflow_runs: data.workflow_runs },
            null,
            2
          ),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
