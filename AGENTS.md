# mcp-pack — agent guide

A pnpm monorepo of small [Model Context Protocol](https://modelcontextprotocol.io)
servers under the `@zeroindex-ai/` scope. Four `npx`-runnable servers (Porkbun,
Mercury, GitHub, Turso) plus one shared HTTP client. Each package builds `tsc → dist`,
no bundler.

The *why* and the repo-level story live in `PROJECT.md`; the shared shape (monorepo
layout, shared client, per-server pattern, redaction posture, how to add a server)
lives in `ARCHITECTURE.md`. The public pitch + install live in `README.md`.

## Guardrails (do not violate)

- **Never commit secrets** (`NPM_TOKEN` lives in CI, not the repo) — check before `git add -A`.
  Vendor credentials live only in environment variables, never in the repo.
- **Public repo → sanitize docs** (no machine paths, vault names, private-memory refs).
  The `md-review-gate` hook enforces it.
- **Branch before the first commit** — confirm `git branch`.
- **Don't break the public API silently.** Any change to an exported entrypoint, type,
  tool name, or tool input/output schema is a semver event — update the package's
  CHANGELOG.md + bump appropriately.
- **Docs must match the artifact.** README/JSDoc claims that lag the shipped code are
  the #1 credibility finding — fix all copies when behavior changes, including the
  root README server table.
- **Mercury ACH redaction is an invariant.** The Mercury server replaces ACH account
  and routing numbers with a sentinel before any account leaves the process, applied
  uniformly across every tool that returns account data. Never weaken or bypass it.

## Commands

```bash
pnpm install
pnpm typecheck     # tsc --noEmit, recursive
pnpm lint          # eslint .
pnpm test          # vitest, recursive
pnpm build         # tsc → dist/, recursive (no bundler)
pnpm format:check  # prettier --check .
```

Run a single server locally during development:

```bash
PORKBUN_API_KEY=pk1_... PORKBUN_SECRET_API_KEY=sk1_... \
  pnpm --filter @zeroindex-ai/mcp-porkbun dev
```

Release (tag-driven, do not `npm publish` by hand):
```bash
# 1. bump every package.json version in lockstep + update each package's CHANGELOG.md, commit
# 2. tag matching that version → CI verifies the tag equals every published
#    package's version, then publishes all of them with provenance
git tag vX.Y.Z && git push --tags
```

## Conventions & gotchas

- **tsc-to-dist, ESM, no bundler.** `files` whitelist + `prepublishOnly` + `publishConfig.access: public`
  in each package.json; `packageManager` field at the root; Node `>=20`.
- **`workspace:*` deps are rewritten at publish time.** Server packages depend on
  `@zeroindex-ai/mcp-http` via `workspace:*`; that range is rewritten to a real
  version at publish. Every package versions in lockstep behind one `vX.Y.Z` tag.
- **Per-server two-file pattern.** `<vendor>.ts` is the thin typed client (reads env-var
  credentials, builds a `createClient` instance per request so rotated creds are picked
  up without a restart); `index.ts` is the MCP entry point (`#!/usr/bin/env node`,
  constructs `McpServer`, registers tools, connects `StdioServerTransport` only when
  invoked directly).
- **Zod output schemas use `.passthrough()`.** Tool inputs are validated; outputs are
  kept loose so harmless vendor-side additions don't break a tool call. A strict
  `z.object()` breaks calls when `structuredContent` carries unmapped vendor objects.
- **Shared `mcp-http` client.** Auth modes are `bearer`, `body` (Porkbun's design), and
  `none`; one overall 30s timeout; a single deliberate retry on `429` (or `403` +
  `x-ratelimit-remaining: 0`); failures surface as `HttpError` with vendor/path/status/body.
- **Read-first.** Initial releases expose only read-only tools; mutating tools land in
  later versions once the read surface has stabilized. Each server ships one cheap
  credential-check tool (`ping`, `list_accounts`, `list_databases`,
  `get_authenticated_user`).
- **Tests mock `fetch`.** Unit and contract tests run against mocked responses and
  fixtures; no live API calls in CI.
- **Adding a server** — see the step-by-step in `ARCHITECTURE.md` (and the
  `add-mcp-server` skill).

## Where to look

- `PROJECT.md` — why it exists, strategic decisions, public contract, distribution, decision log.
- `ARCHITECTURE.md` — monorepo shape, shared client, per-server pattern, redaction posture, adding a server.
- Each `packages/*/CHANGELOG.md` — Keep a Changelog format; every release documented per package.
- `README.md` — the public pitch + install + the server table.
