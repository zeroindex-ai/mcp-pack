# Changelog

All notable changes to `@zeroindex-ai/mcp-turso` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-05-25

No functional changes. Version bumped to keep `mcp-pack` packages in lockstep with the `mcp-mercury@0.2.2` `list_accounts` redaction fix.

## [0.2.1] - 2026-05-18

### Fixed

- `get_database_usage` passes Turso's raw `total` object into `structuredContent`; the `usage` schema now allows unknown keys (`.passthrough()`) so harmless vendor-side additions don't fail validation in MCP clients. Same class of bug fixed in `mcp-mercury@0.2.1`.

## [0.2.0] - 2026-05-17

### Added

- `outputSchema` (Zod) on every registered tool. Responses include `structuredContent` alongside the existing text content.

### Changed

- HTTP client extracted to the shared workspace package `@zeroindex-ai/mcp-http` (`createClient` with bearer auth). Wire-level behaviour unchanged — org-slug path prefixing is still owned per-package. Now benefits from the shared 429/rate-limit retry, 30s timeout, and structured `HttpError`.
- `McpServer` `name` and `version` now read from `package.json` instead of being hand-typed.

### Maintenance

- `prepublishOnly: pnpm build`.
- `.env.example` at package root.

## [0.1.1] - 2026-05-09

Initial public release.

### Added

- 4 read-only MCP tools over Turso's Platform API: `list_databases`, `get_database`, `get_database_usage`, `list_groups`.
- Bearer-auth client with org-slug path prefixing.
- Zod input schemas with `.describe()` on every parameter.
- vitest suite with mocked `globalThis.fetch`.
- README with `claude_desktop_config.json` snippet, including a clear note that this is the Turso **Platform** API (account/billing/usage), not the libSQL data API.
