# Changelog

All notable changes to `@zeroindex-ai/mcp-porkbun` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-05-25

No functional changes. Version bumped to keep `mcp-pack` packages in lockstep with the `mcp-mercury@0.2.2` `list_accounts` redaction fix.

## [0.2.1] - 2026-05-18

### Fixed

- `list_domains` and `list_dns_records` pass raw vendor objects into `structuredContent`; their array-element schemas now allow unknown keys (`.passthrough()`) so harmless Porkbun-side additions don't fail validation in MCP clients. Same class of bug fixed in `mcp-mercury@0.2.1`.

## [0.2.0] - 2026-05-17

### Added

- `outputSchema` (Zod) on every registered tool. Responses now include a `structuredContent` field alongside the existing `text` content, letting MCP clients validate the shape and the LLM see a structured hint.

### Changed

- HTTP client extracted to the shared workspace package `@zeroindex-ai/mcp-http` (`createClient` factory with `kind: 'body'` auth for Porkbun's body-merged credentials). Behaviour unchanged at the wire level — same URLs, headers, body shape, status-field check, and `PorkbunError` semantics. Now benefits from the shared 429/rate-limit retry, central 30s timeout, and structured `HttpError`.
- `McpServer` `name` and `version` now read from `package.json` via JSON module import instead of being hand-typed in `src/index.ts`. Eliminates the drift class that bit `mcp-github-org` in 0.1.x.

### Maintenance

- `prepublishOnly: pnpm build` script added — prevents stale `dist/` publish accidents.
- `.env.example` added at the package root for clearer credential setup.

## [0.1.1] - 2026-05-09

Initial public release.

### Added

- 3 read-only MCP tools over Porkbun's v3 JSON API: `ping`, `list_domains`, `list_dns_records`.
- Body-auth client merging `apikey` + `secretapikey` into every POST body.
- Zod input schemas with `.describe()` on every parameter.
- vitest suite with mocked `globalThis.fetch`.
- README with `claude_desktop_config.json` snippet and credential-setup walkthrough.
