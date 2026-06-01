# Architecture

`mcp-pack` is a pnpm monorepo of small [Model Context Protocol](https://modelcontextprotocol.io)
servers. Each server wraps one third-party API and exposes a handful of typed
tools over stdio, so it can be `npx`-run and dropped into Claude Desktop, Claude
Code, Cursor, Zed, or any other MCP client. This document explains how the repo
is laid out and how the pieces fit together.

## Monorepo shape

```
packages/
├── mcp-http/      # @zeroindex-ai/mcp-http — shared HTTP client (not a server)
├── porkbun/       # @zeroindex-ai/mcp-porkbun
├── mercury/       # @zeroindex-ai/mcp-mercury
├── github-org/    # @zeroindex-ai/mcp-github-org
└── turso/         # @zeroindex-ai/mcp-turso
```

Each package is independently versioned and published to npm under the
`@zeroindex-ai/` scope. The server packages depend on `mcp-http` via a
`workspace:*` dependency; that dependency is rewritten to a real version range
at publish time. Builds are plain `tsc` (no bundler), tests are `vitest`,
linting is flat-config ESLint, and formatting is Prettier — configured once at
the repo root and inherited by every package.

## Data flow

A single server, from credentials to the MCP client:

```
env vars ──▶ createClient(opts)  ──▶ McpServer        ──▶ StdioServerTransport ──▶ MCP client
(per-vendor   (@zeroindex-ai/         (registers each      (stdio; connected        (Claude
 creds, read   mcp-http: auth,         tool with a Zod      only when index.ts        Desktop/
 per request)  30s timeout, 1×         input + .pass-       is invoked directly)      Code, Cursor,
               retry, HttpError)       through() output)                              Zed, …)
                     │
                     ▼
              vendor HTTP API
              (Porkbun / Mercury /
               GitHub / Turso)
```

The `<vendor>.ts` client builds a fresh `createClient` instance per request (cheap;
picks up rotated credentials without a restart) and calls the vendor API; `index.ts`
wires the typed helpers into MCP tools and the stdio transport.

## The shared HTTP client

`@zeroindex-ai/mcp-http` is the one piece of shared runtime code. It exists so
the servers don't each reinvent auth, timeouts, retries, and error shaping.

- **`createClient(opts)`** returns a typed `request` function. It handles base-URL
  joining, header merging, the auth modes below, a single overall timeout
  (`AbortSignal.timeout`, default 30s), and JSON encode/decode.
- **Auth modes** (`types.ts`): `bearer` (token in the `Authorization` header),
  `body` (credentials merged into the JSON body — Porkbun's design), and `none`.
- **Retry** (`retry.ts`): one deliberate retry on a rate-limit response — `429`
  always, or `403` paired with `x-ratelimit-remaining: 0` (GitHub's secondary
  limit). The delay is read from `Retry-After` (both RFC 7231 forms: a
  delta-seconds integer or an HTTP-date), then `x-ratelimit-reset`, else a 1s
  default; every computed delay is clamped to 60s. The retry sleep is cancellable
  by the overall deadline. A single retry — not a storm — covers a transient blip
  without masking a sustained outage. All tools here are read-only GETs, so the
  retry is safe.
- **`HttpError`** carries the vendor, path, status, and response body so failures
  propagate plainly instead of being swallowed.

## The per-server pattern

Every server package follows the same two-file shape:

- **`<vendor>.ts`** — a thin typed client over the vendor API. It reads
  credentials from environment variables, builds a `createClient` instance per
  request (cheap; picks up rotated credentials without a restart), and exports
  small helper functions plus the response types.
- **`index.ts`** — the MCP entry point (`#!/usr/bin/env node`). It constructs an
  `McpServer`, registers each tool with a Zod input schema and a permissive
  (`.passthrough()`) output schema, wires the server to a `StdioServerTransport`,
  and only connects the transport when the file is invoked directly.

Conventions shared across servers:

- **Zod everywhere.** Tool inputs are validated; outputs are kept loose so
  harmless vendor-side additions don't break a tool call.
- **Read-first.** Initial releases expose only read-only tools. Mutating tools
  land in later versions once the read surface has stabilized.
- **A credential-check tool.** Each server has one cheap tool (`ping`,
  `list_accounts`, `list_databases`, `get_authenticated_user`) whose job is to
  validate token + network at runtime — the first call the README tells users to
  make.
- **Tests mock `fetch`.** Unit and contract tests run against mocked responses
  and fixtures; no live API calls in CI.

## Redaction / privacy posture

These servers run locally and talk to a user's own accounts, so the threat model
is mostly about what gets handed back to the model.

- **Credentials live only in environment variables** and are never logged or
  echoed into tool output. The repo ships no secrets; secret scanning is enabled
  on the remote.
- **Sensitive fields are redacted by default.** The Mercury server replaces ACH
  account and routing numbers with a sentinel before any account leaves the
  process, applied uniformly across the tools that return account data, so the
  redaction holds even for the first call a user makes.
- **No hidden retries that hide failures.** Errors surface as `HttpError` with the
  vendor and status intact rather than being silently retried away.

## Adding a server

1. Create `packages/<vendor>/` with its own `package.json` (`@zeroindex-ai/mcp-<vendor>`,
   a `bin`, `main`/`types` pointing at `dist`, and a `workspace:*` dependency on
   `@zeroindex-ai/mcp-http`).
2. Write `src/<vendor>.ts`: read env-var credentials, build the client with
   `createClient` (pick the right auth mode), and export typed read-only helpers
   plus response types.
3. Write `src/index.ts`: register each tool on an `McpServer` with a Zod input
   schema and a `.passthrough()` output schema, including one cheap
   credential-check tool. Connect a `StdioServerTransport` only when invoked
   directly.
4. Add tests that mock `fetch` (and fixtures for contract tests where useful).
5. Write a `README.md` with the required env vars and a Claude Desktop config
   snippet. Add the package to the root `README.md` table.
6. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check` — all green
   before opening a PR.
