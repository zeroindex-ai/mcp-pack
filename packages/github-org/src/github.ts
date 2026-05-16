// Thin GitHub REST v3 client.
//
// Auth: Bearer token in the Authorization header. Use a Personal Access Token
// (classic or fine-grained) provisioned at github.com/settings/tokens.
// Endpoints used here are read-only (GET); see README for required scopes.
// The `get_authenticated_user` tool doubles as a runtime credential check.
//
// Rate-limit handling (429 + 403/x-ratelimit-remaining:0) is delegated to the
// shared @zeroindex-ai/_http client.

import { createClient, HttpError, type Client } from '@zeroindex-ai/_http';

const BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const USER_AGENT = '@zeroindex-ai/mcp-github-org';

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  return token;
}

function client(): Client {
  return createClient({
    vendor: 'GitHub',
    baseUrl: BASE,
    auth: { kind: 'bearer', token: getToken() },
    defaultHeaders: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': USER_AGENT,
    },
  });
}

export async function gh<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  // Re-narrow boolean values to strings for the shared client (which accepts
  // string | number | undefined). Matches existing call-site behaviour.
  const stringified: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    stringified[k] = typeof v === 'boolean' ? String(v) : v;
  }
  return client()<T>({ method: 'GET', path, query: stringified });
}

export { HttpError };

export type AuthenticatedUser = {
  login: string;
  id: number;
  type: string;
  name: string | null;
  email: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  total_private_repos: number | null;
  owned_private_repos: number | null;
  plan?: { name: string; space: number; collaborators: number; private_repos: number };
};

export type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
  open_issues_count: number;
  language: string | null;
  archived: boolean;
  visibility: string;
};

export type PullRequest = {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: { login: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
};

export type Issue = {
  number: number;
  title: string;
  state: string;
  user: { login: string } | null;
  labels: Array<{ name: string } | string>;
  assignees: Array<{ login: string }> | null;
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown; // present when the API returns a PR in /issues; we filter these out
};

export type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
  head_sha: string;
  event: string;
  run_number: number;
  run_attempt: number;
};

export type WorkflowRunsResponse = { total_count: number; workflow_runs: WorkflowRun[] };

// GitHub's /issues endpoint returns pull requests too; `pull_request` is present
// only on PR-disguised-as-issue entries. Filtering on truthiness keeps real
// issues (where the field is undefined).
export function filterOutPullRequests(items: Issue[]): Issue[] {
  return items.filter((i) => !i.pull_request);
}

// GitHub Actions has two distinct path shapes for listing runs: scoped to a
// specific workflow file/id, or across the whole repo.
export function workflowRunsPath(owner: string, repo: string, workflow?: string): string {
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions`;
  return workflow ? `${base}/workflows/${encodeURIComponent(workflow)}/runs` : `${base}/runs`;
}
