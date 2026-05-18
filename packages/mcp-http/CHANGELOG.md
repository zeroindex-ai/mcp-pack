# Changelog

All notable changes to `@zeroindex-ai/mcp-http` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-05-18

No functional changes. Version bumped to keep `mcp-pack` packages in lockstep with the `mcp-mercury` / `mcp-porkbun` / `mcp-turso` 0.2.1 patch.

## [0.2.0] - 2026-05-17

Initial public release. Promoted from the internal `@zeroindex-ai/_http` workspace package so the four MCP server packages in `mcp-pack` can be published with a real npm-resolvable dependency.

### Added

- `createClient({ vendor, baseUrl, auth, defaultHeaders?, timeoutMs?, retryOn429? })` factory that returns a typed `request<T>(opts)` function.
- Three auth shapes: `{ kind: 'bearer', token }`, `{ kind: 'body', fields }` (merged into JSON body), `{ kind: 'none' }`.
- 30s timeout on every request via `AbortSignal.timeout(timeoutMs)`.
- One-shot 429 / `403 + x-ratelimit-remaining: 0` retry honouring `Retry-After` or computing wait from `x-ratelimit-reset` (capped at 60s).
- Structured `HttpError(vendor, path, status, body)` thrown on non-OK responses.
- Pure helpers: `shouldRetry(res)`, `retryDelayMs(res, now?)`, `sleep(ms, signal?)`.
- 27 vitest cases (15 retry-helper + 12 createClient).
