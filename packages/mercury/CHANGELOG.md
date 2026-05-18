# Changelog

All notable changes to `@zeroindex-ai/mcp-mercury` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-17

### Changed

- **BREAKING:** `get_account` now redacts `accountNumber` and `routingNumber` from its response by default. Consumers who relied on the raw ACH numbers being piped to the LLM must opt in explicitly by passing `includeBankNumbers: true` in the tool's input. The README's Privacy section explains the rationale: an LLM does not need full bank-account numbers to answer common questions ("what's my balance?", "list my recent transactions"); shipping them by default is an unnecessary exposure.
- HTTP client extracted to the shared workspace package `@zeroindex-ai/mcp-http` (`createClient` with `kind: 'bearer'` auth). Wire-level behaviour unchanged.
- `McpServer` `name` and `version` now read from `package.json` instead of being hand-typed.

### Added

- `outputSchema` (Zod) on every registered tool. Responses include `structuredContent`; `get_account`'s schema marks `accountNumber` / `routingNumber` as optional so the redacted variant still validates.
- Top-level Privacy section in `README.md` documenting the redaction-by-default behaviour and the opt-in flag.

### Maintenance

- `prepublishOnly: pnpm build`.
- `.env.example` at package root.

## [0.1.1] - 2026-05-09

Initial public release.

### Added

- 3 read-only MCP tools over Mercury's v1 API: `list_accounts`, `get_account`, `list_transactions` (with date filtering).
- Bearer-auth client over Mercury's API base.
- Zod input schemas with `.describe()` on every parameter.
- vitest suite with mocked `globalThis.fetch`.
- README with `claude_desktop_config.json` snippet, credential-setup walkthrough, and a data-flow diagram explaining that Mercury → this process → MCP client → LLM.
