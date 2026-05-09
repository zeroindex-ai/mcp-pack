// Thin GitHub REST v3 client.
//
// Auth: Bearer token in the Authorization header. Use a Personal Access Token
// (classic or fine-grained) provisioned at github.com/settings/tokens.
// Endpoints used here are read-only (GET); see README for required scopes.
// The `get_authenticated_user` tool doubles as a runtime credential check.

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

export async function gh<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${getToken()}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': API_VERSION,
      'user-agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${path} HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

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
