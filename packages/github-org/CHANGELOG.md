# Changelog

All notable changes to `@zeroindex-ai/mcp-github-org` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-05-18

No functional changes. Version bumped to keep `mcp-pack` packages in lockstep with the `mcp-mercury` / `mcp-porkbun` / `mcp-turso` 0.2.1 patch. This package was unaffected because every tool maps the vendor response to an explicit projection before returning `structuredContent`, so the strict output schemas don't see unknown keys.

## [0.2.0] - 2026-05-17

### Added

- `outputSchema` (Zod) on every registered tool. Responses include `structuredContent` alongside the existing text content.

### Changed

- HTTP client extracted to the shared workspace package `@zeroindex-ai/mcp-http` (`createClient` with bearer auth + `X-GitHub-Api-Version: 2022-11-28` default header). The local one-shot 429 / `403 + x-ratelimit-remaining: 0` retry logic added in 0.1.x is now provided by the shared client and applied uniformly across every Mercury / Porkbun / Turso / GitHub call.
- `McpServer` `name` and `version` now read from `package.json` instead of being hand-typed. Fixes the 0.1.1-in-code / 0.1.2-in-pkg drift class.

### Maintenance

- `prepublishOnly: pnpm build`.
- `.env.example` at package root.

## [0.1.2] - 2026-05-13

### Added

- One-shot 429 / `403 + x-ratelimit-remaining: 0` retry honouring `Retry-After` and `x-ratelimit-reset` headers in the GitHub-specific client. (Hoisted into `@zeroindex-ai/mcp-http` in 0.2.0.)
- Vitest cases covering the retry-after, rate-limit-reset, and double-failure paths.

## [0.1.1] - 2026-05-09

Initial public release.

### Added

- 5 read-only MCP tools: `get_authenticated_user`, `list_org_repos`, `list_pull_requests`, `list_issues`, `list_workflow_runs`.
- Bearer-auth client + GitHub API-version header.
- Zod input schemas with `.describe()` on every parameter.
- vitest suite with mocked `globalThis.fetch` covering URL construction, header propagation, and pure helpers (`filterOutPullRequests`, `workflowRunsPath`).
- README with `claude_desktop_config.json` snippet and a 1Password-CLI credential-loading walkthrough.
