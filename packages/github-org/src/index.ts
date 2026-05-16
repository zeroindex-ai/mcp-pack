#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
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

// Permissive outputSchema shapes — vendor APIs drift; we keep these loose so
// harmless additions don't break tool calls.
const getAuthenticatedUserOutput = z.object({
  login: z.string(),
  id: z.number(),
  name: z.string().nullable().optional(),
});

const listOrgReposOutput = z.object({
  repos: z.array(
    z.object({
      name: z.string(),
      full_name: z.string(),
      private: z.boolean(),
      description: z.string().nullable().optional(),
    })
  ),
});

const listPullRequestsOutput = z.object({
  pull_requests: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      state: z.string(),
      user: z.string().optional(),
    })
  ),
});

const listIssuesOutput = z.object({
  issues: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      state: z.string(),
      user: z.string().optional(),
    })
  ),
});

const listWorkflowRunsOutput = z.object({
  runs: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      status: z.string(),
      conclusion: z.string().nullable().optional(),
      branch: z.string().optional(),
    })
  ),
});

export function createServer(): McpServer {
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  server.registerTool(
    'get_authenticated_user',
    {
      title: 'Verify GitHub credentials',
      description:
        'Returns the authenticated user (token owner), plan info, and repo counts. Run this first to verify the token works and discover what scopes you have.',
      inputSchema: {},
      outputSchema: getAuthenticatedUserOutput.shape,
    },
    async () => {
      const data = await gh<AuthenticatedUser>('/user');
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { login: data.login, id: data.id, name: data.name },
      };
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
      outputSchema: listOrgReposOutput.shape,
    },
    async ({ org, type, sort, per_page, page }) => {
      const data = await gh<Repo[]>(`/orgs/${encodeURIComponent(org)}/repos`, {
        type,
        sort,
        per_page,
        page,
      });
      const repos = data.map((r) => ({
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        description: r.description,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { repos },
      };
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
        state: z.enum(['open', 'closed', 'all']).optional().describe('PR state filter (default "open").'),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
      outputSchema: listPullRequestsOutput.shape,
    },
    async ({ owner, repo, state, per_page, page }) => {
      const data = await gh<PullRequest[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
        { state, per_page, page }
      );
      const pull_requests = data.map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        user: p.user?.login,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { pull_requests },
      };
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
        state: z.enum(['open', 'closed', 'all']).optional().describe('Issue state filter (default "open").'),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
      outputSchema: listIssuesOutput.shape,
    },
    async ({ owner, repo, state, per_page, page }) => {
      const data = await gh<Issue[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        { state, per_page, page }
      );
      const filtered = filterOutPullRequests(data);
      const issues = filtered.map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        user: i.user?.login,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
        structuredContent: { issues },
      };
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
          .describe(
            'Filter by triggering event ("push", "pull_request", "schedule", "workflow_dispatch", ...).'
          ),
        status: z
          .enum(['queued', 'in_progress', 'completed', 'success', 'failure', 'cancelled', 'skipped'])
          .optional()
          .describe('Filter by status (in-flight) or conclusion (completed).'),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
      outputSchema: listWorkflowRunsOutput.shape,
    },
    async ({ owner, repo, workflow, branch, event, status, per_page, page }) => {
      const data = await gh<WorkflowRunsResponse>(workflowRunsPath(owner, repo, workflow), {
        branch,
        event,
        status,
        per_page,
        page,
      });
      const runs = data.workflow_runs.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        branch: r.head_branch,
      }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total_count: data.total_count,
                count: data.workflow_runs.length,
                workflow_runs: data.workflow_runs,
              },
              null,
              2
            ),
          },
        ],
        structuredContent: { runs },
      };
    }
  );

  return server;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
