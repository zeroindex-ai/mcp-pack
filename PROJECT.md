# mcp-pack — Project Documentation

> **Phase:** Published
> **npm:** https://www.npmjs.com/org/zeroindex-ai · **Repo:** github.com/zeroindex-ai/mcp-pack

Open-source [Model Context Protocol](https://modelcontextprotocol.io) servers for solo
founders and small teams running a stack of SaaS tools. Each server is a small,
narrowly-scoped wrapper around one third-party API, `npx`-runnable and dropped into
Claude Desktop, Claude Code, Cursor, Zed, or any other MCP client.

This PROJECT.md covers the repo-level story. The per-package detail lives in each
`packages/*/README.md`; the shared shape (monorepo layout, shared client, per-server
pattern, redaction posture, adding a server) lives in `ARCHITECTURE.md`; the public
pitch + install live in `README.md`.

---

## 1. Why this exists

Solo founders and small teams run a stack of SaaS tools (domains, banking, source
control, databases) that an LLM agent could usefully read and act on — but each vendor's
API needs auth, error handling, and a typed tool surface before a model can touch it
safely. mcp-pack ships that wrapper once per vendor, so any MCP client gets a small,
well-named tool set against a tool you already use. Each server wraps something
ZeroIndex uses itself, so the first user is always us (dogfooding).

The hard boundary: each server is a narrow, local, `npx`-runnable wrapper around **one**
vendor — not a hosted gateway, not a kitchen-sink aggregator, and not a place for hidden
retries that mask vendor failures.

### Goals & success criteria

| Goal | How I'll know it's met | Status |
| --- | --- | --- |
| Each vendor's read surface usable from any MCP client with zero clone/build | `npx @zeroindex-ai/mcp-<vendor>` runs in Claude Desktop/Code, Cursor, Zed | ☑ four servers published |
| First call always validates creds + network cheaply | every server ships a credential-check tool the README tells users to run first | ☑ |
| Dogfooded, not speculative | every server wraps a tool ZeroIndex already pays for/uses | ☑ |
| Vendor failures surface plainly, never masked | failures throw `HttpError` with vendor/path/status/body; single retry only | ☑ |

## 2. Strategic decisions

### Tech stack

| Choice | Why this | Alternative rejected |
| --- | --- | --- |
| pnpm 10 · TypeScript ESM · `tsc → dist` (no bundler) | house default; configured once at the repo root and inherited by every package | a bundler — pointless for `npx` CLIs with a `bin`, adds build complexity |
| vitest · flat-config ESLint · Prettier | house default; tests mock `fetch` so no live calls in CI | — |
| pnpm monorepo (not one repo per server) | the four servers share auth/timeout/retry/error-shaping, so they share one HTTP client + one root toolchain | separate repos — would duplicate config and the shared client |
| `@modelcontextprotocol/sdk` + `zod` | the only runtime deps beyond the shared client; the MCP SDK is the protocol, Zod the schema layer | — |
| MIT · Node `>=20` | — | — |

### Key decisions

- **Single monorepo, not one repo per server.** Trade-off accepted: every package
  versions in lockstep behind a single `vX.Y.Z` tag.
- **Read-first cadence.** Initial releases expose only read-only tools; mutating tools
  land in later versions once the read surface has stabilized. Each server ships one
  cheap credential-check tool as the first call the README tells users to make.
- **Shared client is published, not bundled.** `@zeroindex-ai/mcp-http` is published to
  npm (since v0.2.0) so the `workspace:*` dep resolves to a real version range for
  consumers when it's rewritten at publish.
- **Deliberately NOT chosen** — no bundler, no hosted platform, no extra runtime deps
  beyond the MCP SDK + Zod + the shared client, no hidden retry storms.

## 3. Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the monorepo shape, the shared HTTP client
(`createClient`, auth modes, the single-retry policy, `HttpError`), the per-server
two-file pattern (`<vendor>.ts` + `index.ts`), the redaction / privacy posture (Mercury
ACH redaction invariant), the env-var → `createClient` → `McpServer` → stdio data-flow
diagram, and the step-by-step for adding a server. Not duplicated here.

## 4. Public contract

The breaking-change boundary is the set of published packages and their tool surfaces.
Any change to an exported entrypoint, tool name, or tool input/output schema is a semver
event.

- **Servers** (each ships a `bin`, reads credentials from env vars, speaks MCP over stdio):
  - `@zeroindex-ai/mcp-porkbun` (domains + DNS) — `ping`, `list_domains`, `list_dns_records`
  - `@zeroindex-ai/mcp-mercury` (banking, read-only) — `list_accounts`, `get_account`, `list_transactions`
  - `@zeroindex-ai/mcp-github-org` (repos/PRs/issues/Actions) — `get_authenticated_user`, `list_org_repos`, `list_pull_requests`, `list_issues`, `list_workflow_runs`
  - `@zeroindex-ai/mcp-turso` (databases/groups/usage) — `list_databases`, `get_database`, `get_database_usage`, `list_groups`
- **Shared helper** — `@zeroindex-ai/mcp-http`, the small HTTP client the four servers
  depend on (auth, 30s timeout, 429 retry, `HttpError`). Published so the version range
  resolves for consumers when the `workspace:*` dep is rewritten at publish. Exports
  `createClient`, `HttpError`, the pure helpers `shouldRetry`/`retryDelayMs`/`sleep`, and
  the auth types.
- **Tool contract** — Zod-validated inputs; `.passthrough()` outputs (loose, so harmless
  vendor additions don't break a call). See each package's README for the tool list and
  required env vars.

## 5. Data model

— n/a: no database. Each server is stateless and reads only from its vendor API. The
sole structured inputs are per-server credential env vars:

| Server | Required env vars |
| --- | --- |
| mcp-porkbun | `PORKBUN_API_KEY`, `PORKBUN_SECRET_API_KEY` |
| mcp-mercury | `MERCURY_API_TOKEN` |
| mcp-github-org | `GITHUB_TOKEN` |
| mcp-turso | `TURSO_API_TOKEN`, `TURSO_ORG_SLUG` |

## 6. Project structure

```
packages/
├── mcp-http/        # @zeroindex-ai/mcp-http — shared HTTP client (library, no bin)
│   └── src/         # createClient.ts · retry.ts · types.ts · index.ts (+ *.test.ts)
├── porkbun/         # @zeroindex-ai/mcp-porkbun
│   └── src/         # porkbun.ts (typed client) · index.ts (MCP entry, bin) (+ *.test.ts)
├── mercury/         # @zeroindex-ai/mcp-mercury — has contract.test.ts (fixture-based)
├── github-org/      # @zeroindex-ai/mcp-github-org
└── turso/           # @zeroindex-ai/mcp-turso — has contract.test.ts (fixture-based)

.github/workflows/   # ci.yml (lint/build/typecheck/test) · release.yml (publish on v* tags)
ARCHITECTURE.md      # monorepo shape · shared client · per-server pattern · redaction · diagram
AGENTS.md · CLAUDE.md
```

Every server package follows the same two-file shape: `<vendor>.ts` is the thin typed
client (reads env-var credentials, builds a `createClient` instance per request),
`index.ts` is the MCP entry point (`#!/usr/bin/env node`, builds `McpServer`, registers
tools, connects `StdioServerTransport` only when invoked directly).

## 7. Distribution

- **npm** — all packages under the `@zeroindex-ai/` scope; each server is `npx`-runnable
  with no clone or build. Tag-driven release with provenance: CI verifies the `vX.Y.Z`
  tag equals every published package's version, then publishes all of them.
- **CI** — `ci.yml` runs lint, build, typecheck, and test on push + PR; `release.yml`
  publishes on `v*` tags.

### Config / env-var

| Var | Where | Purpose |
| --- | --- | --- |
| `NPM_TOKEN` | CI only (Read+Write on the whole `@zeroindex-ai` scope) | provenance publish; never in the repo |
| `PORKBUN_API_KEY` / `PORKBUN_SECRET_API_KEY` | user env | mcp-porkbun auth (body-field mode) |
| `MERCURY_API_TOKEN` | user env | mcp-mercury auth (bearer) |
| `GITHUB_TOKEN` | user env | mcp-github-org auth (bearer) |
| `TURSO_API_TOKEN` / `TURSO_ORG_SLUG` | user env | mcp-turso auth (bearer) + org scoping |

## 8. Testing & evaluation

Unit and contract tests run under **vitest** with **`fetch` mocked** — no live API calls
in CI (~98 cases across the five packages). The shared client has retry-helper +
`createClient` unit tests; mercury and turso add fixture-based `contract.test.ts` that
assert the tool output shape (and, for mercury, the ACH-redaction invariant). CI runs
the suite on push + PR via `ci.yml`.

---

## Ordered work list

- [ ] Hold scope at the four current servers — next motion is **v0.2 depth, not breadth**
  (decision 2026-05-12). No new vendors until depth is proven.
- [ ] Per-vendor: add mutating tools (deferred behind the read-first cadence) once each
  read surface has stabilized.
- [ ] Re-evaluate per-package release flow only if vendor cadences diverge enough that
  lockstep versioning becomes a real cost (see constraints).

## Decision log (running)

Newest first.

- **2026-06-01** — Normalized PROJECT.md to the 14-section ZeroIndex baseline: added the
  Goals table, Project structure tree, Distribution config/env-var table, Data-model
  (n/a) section, Testing note, and Ordered work list. Kept the PROJECT.md/ARCHITECTURE.md
  split (validated as worth it). Fixed an accuracy bug in `packages/mcp-http/README.md`
  (still claimed the package was internal `@zeroindex-ai/_http`, "Not published" — it went
  public as `@zeroindex-ai/mcp-http` in v0.2.0).
- **2026-05-31** — Backfilled the ZeroIndex doc standard (AGENTS.md, CLAUDE.md, this
  PROJECT.md). README.md and ARCHITECTURE.md were already canonical and left untouched;
  per-package CHANGELOGs are the monorepo norm, so no root CHANGELOG was added.

## Known constraints & future work

- Every package versions in lockstep behind one tag (the cost of the single-monorepo
  choice). A per-package release flow is a future option if cadences diverge.
- Mutating tools remain deferred per the read-first cadence; mcp-pack scope is paused at
  the four current servers — next motion is v0.2 depth, not breadth.

## Cross-references

- ARCHITECTURE.md · README.md · each `packages/*/README.md` · each `packages/*/CHANGELOG.md`
