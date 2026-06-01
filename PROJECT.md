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

## 2. Strategic decisions

- **Stack** — pnpm 10 · TypeScript ESM · `tsc → dist` (no bundler) · vitest · flat-config
  ESLint · Prettier · MIT · Node `>=20`. Configured once at the repo root and inherited
  by every package.
- **Single monorepo, not one repo per server.** The four servers share the same auth /
  timeout / retry / error-shaping needs, so they share one HTTP client
  (`@zeroindex-ai/mcp-http`) and one root toolchain. Splitting them into separate repos
  would duplicate config and the shared client. Trade-off accepted: every package
  versions in lockstep behind a single `vX.Y.Z` tag.
- **Read-first cadence.** Initial releases expose only read-only tools; mutating tools
  land in later versions once the read surface has stabilized. Each server ships one
  cheap credential-check tool as the first call the README tells users to make.
- **Things deliberately NOT chosen** — no bundler, no hosted platform, no extra runtime
  deps beyond the MCP SDK + Zod + the shared client, no hidden retry storms.

## 3. Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the monorepo shape, the shared HTTP client
(`createClient`, auth modes, the single-retry policy, `HttpError`), the per-server
two-file pattern (`<vendor>.ts` + `index.ts`), the redaction / privacy posture (Mercury
ACH redaction invariant), and the step-by-step for adding a server. Not duplicated here.

## 4. Public contract

The breaking-change boundary is the set of published packages and their tool surfaces.
Any change to an exported entrypoint, tool name, or tool input/output schema is a semver
event.

- **Servers** — `@zeroindex-ai/mcp-porkbun` (Porkbun: domains + DNS),
  `@zeroindex-ai/mcp-mercury` (Mercury: banking, read-only),
  `@zeroindex-ai/mcp-github-org` (GitHub: repos, PRs, issues, Actions),
  `@zeroindex-ai/mcp-turso` (Turso: databases, groups, usage). Each ships a `bin`,
  reads its credentials from environment variables, and speaks MCP over stdio.
- **Shared helper** — `@zeroindex-ai/mcp-http`, the small HTTP client the four servers
  depend on (auth, 30s timeout, 429 retry, `HttpError`). Published so the version range
  resolves for consumers when the `workspace:*` dep is rewritten at publish.
- **Tool contract** — Zod-validated inputs; `.passthrough()` outputs (loose, so harmless
  vendor additions don't break a call). See each package's README for the tool list and
  required env vars.

## 5. Distribution

- **npm** — all packages under the `@zeroindex-ai/` scope; each is `npx`-runnable with no
  clone or build. Tag-driven release with provenance: CI verifies the `vX.Y.Z` tag equals
  every published package's version, then publishes all of them. `NPM_TOKEN` (Read+Write
  on the whole scope) lives in CI, not the repo.
- **CI** — `ci.yml` runs lint, build, typecheck, and test on push + PR; `release.yml`
  publishes on `v*` tags.

---

## Decision log (running)

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
