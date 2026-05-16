# @zeroindex-ai/\_http

Internal HTTP client shared by mcp-pack vendor wrappers. Not published.

Handles: auth (bearer/body/none), 30s timeout, 429 + x-ratelimit-remaining retry, structured HttpError.

Used by: mcp-porkbun, mcp-mercury, mcp-github-org, mcp-turso.
