// Thin Turso Platform API v1 client.
//
// Auth: Bearer token in the Authorization header. Mint at the Turso
// dashboard (Settings → API Tokens) or via the CLI:
//   turso auth api-tokens mint claude-mcp-<host>
//
// Every endpoint is org-scoped — TURSO_ORG_SLUG is required alongside
// TURSO_API_TOKEN and gets prepended into `/v1/organizations/<slug>/...`
// inside this client, so callers pass subpaths like `/databases` only.
//
// This package exercises only GET endpoints; the token authorizes write
// operations elsewhere, so treat it as a credential and keep it secret.
//
// Paths verified against Turso Platform API v1 docs (docs.turso.tech/
// api-reference) on 2026-05-11. The `list_databases` tool exists to
// validate token + org slug + network at runtime — call it first.

const BASE = 'https://api.turso.tech';

function getToken(): string {
  const token = process.env.TURSO_API_TOKEN;
  if (!token) {
    throw new Error('TURSO_API_TOKEN environment variable is required');
  }
  return token;
}

function getOrgSlug(): string {
  const slug = process.env.TURSO_ORG_SLUG;
  if (!slug) {
    throw new Error('TURSO_ORG_SLUG environment variable is required');
  }
  return slug;
}

export async function tg<T>(
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE}/v1/organizations/${encodeURIComponent(getOrgSlug())}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${getToken()}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Turso ${path} HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export type DatabaseParent = {
  id: string;
  name: string;
  branched_at: string;
};

export type Database = {
  Name: string;
  DbId: string;
  Hostname: string;
  block_reads: boolean;
  block_writes: boolean;
  regions: string[];
  primaryRegion: string;
  group: string;
  delete_protection: boolean;
  parent: DatabaseParent | null;
};

export type ListDatabasesResponse = { databases: Database[] };
export type GetDatabaseResponse = { database: Database };

export type UsageBucket = {
  rows_read: number;
  rows_written: number;
  storage_bytes: number;
  bytes_synced: number;
};

export type DatabaseInstanceUsage = {
  uuid: string;
  usage: UsageBucket;
};

export type DatabaseUsage = {
  uuid: string;
  instances: DatabaseInstanceUsage[];
  total: UsageBucket;
};

export type GetDatabaseUsageResponse = { database: DatabaseUsage };

export type Group = {
  name: string;
  version: string;
  uuid: string;
  locations: string[];
  primary: string;
  delete_protection: boolean;
};

export type ListGroupsResponse = { groups: Group[] };
