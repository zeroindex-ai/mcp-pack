# @zeroindex-ai/mcp-http

Small HTTP client shared by the `@zeroindex-ai/mcp-*` servers. Published to npm
(public, since v0.2.0) so the four server packages resolve a real version range when
their `workspace:*` dependency is rewritten at publish time.

Handles: auth (bearer/body/none), 30s timeout, 429 + x-ratelimit-remaining retry, structured HttpError.

Used by: mcp-porkbun, mcp-mercury, mcp-github-org, mcp-turso.
