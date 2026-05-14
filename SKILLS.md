# Adding a new MCP server to mcp-pack

A repeatable recipe distilled from `@zeroindex-ai/mcp-porkbun` and `@zeroindex-ai/mcp-mercury`. Follow it top-to-bottom for any new vendor wrapper.

> **Promote this to a Claude Code Skill:** copy or move this file to `.claude/skills/add-mcp-server.md`, add a YAML frontmatter block (`name`, `description`, optional `allowed-tools`), and Claude will be able to invoke it via the `Skill` tool when you say *"add a new MCP server for X"*.

---

## 0. Decide the scope before you write code

Answer these in writing (a one-liner each is fine; don't skip):

- **Vendor** — which API are we wrapping?
- **What does it let me ask Claude?** — list 3 example questions a user would actually type. If you can't, the server isn't worth building.
- **Tool surface (v0.1)** — list 3–5 read-only tools. Mutating operations come later behind a separate version bump.
- **Auth model** — API key in body / header (Bearer or other) / OAuth / session token. OAuth is significantly harder; if it's OAuth-only, scope a spike before committing to the full server.
- **Runtime credential validator** — pick the cheapest read endpoint (e.g. `ping`, `list_*`) as your first tool. It doubles as the "did the token work?" check.

---

## 1. Verify vendor API specifics *before* writing the client

Per `feedback_verify_before_recommend`. Don't trust your training data for paths and field names.

1. Pull the OpenAPI spec or docs page. If WebFetch / curl returns 403 (common for JS-rendered docs portals), fall back to the vendor's own request examples and **document in the README that paths were locked in from the v1 docs at `<URL>`** so future-you can re-verify.
2. Confirm:
   - Base URL (e.g. `https://api.vendor.com/v1`)
   - Auth header / body shape (header name + token format, or body field names like `apikey` + `secretapikey`)
   - HTTP method per endpoint (Mercury is GET-only on reads; Porkbun is POST-everything)
   - Query vs body for filters / pagination
   - Pagination model (offset/limit vs cursor vs page number)
   - Success response shape — `{ status: "SUCCESS", ... }` vs raw object vs `{ data: ... }`
   - Error response shape (HTTP code + JSON body shape)

---

## 2. Create the package skeleton

From the repo root:

```bash
mkdir -p packages/<vendor>/src
```

Copy these four files from an existing package (porkbun or mercury) and search-replace `porkbun`/`mercury` → `<vendor>`:

```
packages/<vendor>/package.json
packages/<vendor>/tsconfig.json
packages/<vendor>/src/index.ts          # rewrite tools (see §4)
packages/<vendor>/src/<vendor>.ts       # rewrite client (see §3)
packages/<vendor>/src/<vendor>.test.ts  # rewrite tests (see §5)
packages/<vendor>/README.md             # rewrite (see §6)
```

`package.json` checklist (don't skip any):

- `"name": "@zeroindex-ai/mcp-<vendor>"`
- `"version": "0.1.0"` — bump on releases, not commits
- `"type": "module"`
- `"bin": { "mcp-<vendor>": "dist/index.js" }` — required for `npx` invocation
- `"main"`, `"types"`, `"files": ["dist", "README.md", "LICENSE"]` — copy the monorepo root `LICENSE` into `packages/<vendor>/LICENSE` so the published npm tarball ships with the actual MIT text (npm shows the SPDX badge from the `license` field either way, but downstream license-scanning tools and many corporate policies require the file)
- `"dependencies"`: `@modelcontextprotocol/sdk` + `zod` only — keep runtime tree minimal
- `"publishConfig": { "access": "public" }` — required for scoped public npm packages
- `"repository.directory": "packages/<vendor>"` — npm uses this to deep-link from the registry to the source folder
- `"keywords"` — include `mcp`, `model-context-protocol`, `claude`, plus vendor-specific terms

---

## 3. API client (`src/<vendor>.ts`)

Pattern (adapt method/auth to vendor):

```ts
const BASE = 'https://api.vendor.com/v1';

function getCreds(): string {
  const token = process.env.VENDOR_API_TOKEN;
  if (!token) throw new Error('VENDOR_API_TOKEN environment variable is required');
  return token;
}

export async function vd<T>(path: string, /* method/body/query as needed */): Promise<T> {
  // 1. Build URL (URL + searchParams for GET; or POST body)
  // 2. Add auth (Bearer header OR body field)
  // 3. fetch(...)
  // 4. if (!res.ok) throw with status + response body text
  // 5. parse JSON; if vendor uses status-in-body convention, check status !== "SUCCESS" and throw with vendor message
  // 6. return typed
}

// Export typed response shapes — keep them close to the wire so callers can
// access fields without "any" casts. Use Record<string, unknown> for free-form
// nested objects you don't model.
export type Account = { id: string; name: string; ... };
```

Rules:

- **Lazy credential check** — call `getCreds()` *inside* `vd()`, not at module load. Lets the MCP server boot without secrets so `tools/list` works in any environment.
- **Throw plainly** — error messages should include the path, the HTTP status, and the response body text when available. The MCP client surfaces these to the LLM, which then explains them to the user. Don't catch and re-wrap into generic strings.
- **No retries** — vendor failures should propagate. Hidden retries hide rate limits and quota issues.
- **No request logging** — banking/PII data flows through here; never log tokens or request bodies.
- **Per-request timeout** — pass `signal: AbortSignal.timeout(30_000)` on every `fetch(...)` so a hung vendor endpoint can't hang the MCP tool call indefinitely. The MCP client may time out first, but failing closed with a clear `AbortError` is better than the alternative.
- **Org-scoped paths** — when the vendor embeds an organization slug into every path (Turso: `/v1/organizations/<slug>/...`), capture it as a second env var (e.g. `<VENDOR>_ORG_SLUG`), validate it lazily the same way as the token, and prepend it to all paths *inside* the client so callers pass only the subpath like `/databases`. Document both env vars in the README.

---

## 4. Server entry (`src/index.ts`)

Required first line: `#!/usr/bin/env node` — the shebang must be at the top of the source file; TypeScript preserves it in the compiled output, and `bin` entries need it for direct invocation.

```ts
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { vd, type Account } from './vendor.js';

const server = new McpServer({
  name: '@zeroindex-ai/mcp-<vendor>',
  version: '0.1.0',
});

server.registerTool(
  'list_accounts',                           // snake_case, verb-first when applicable
  {
    title: 'List all accounts',              // short, human-friendly
    description:
      'Returns every account in the workspace. Run this first to verify ' +
      'credentials and discover IDs for the other tools.',                // long, behavior-focused
    inputSchema: {                            // Zod RAW SHAPE (object of schemas), not z.object(...)
      // empty for no-arg tools
    },
  },
  async () => {
    const data = await vd<{ accounts: Account[] }>('/accounts');
    return { content: [{ type: 'text', text: JSON.stringify(data.accounts, null, 2) }] };
  }
);

// ... more registerTool calls

const transport = new StdioServerTransport();
await server.connect(transport);
```

Schema gotchas:

- `inputSchema` takes a **Zod raw shape** (`{ id: z.string(), n: z.number() }`), NOT a `z.object(...)`.
- Always call `.describe('...')` on each field — the LLM uses these descriptions to decide what to put in each argument.
- Constrain types tightly: `.regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')` on date strings, `.min(1).max(500)` on `limit`, `.uuid()` on IDs when they really are UUIDs.

Tool naming:

- `snake_case`, action-first: `list_*`, `get_*`, `search_*`, `create_*`.
- Avoid generic names like `query` or `do` — every other server has those, the LLM will get confused.
- One vendor concept per tool — `list_domains` and `list_dns_records`, not `list("domains" | "dns")`.

Read-only first. Mutating tools land in v0.2+ behind an explicit opt-in env var or annotation.

---

## 5. Tests (`src/<vendor>.test.ts`)

Mirror the `mercury.test.ts` / `porkbun.test.ts` shape. Five tests minimum:

1. **Success path with auth** — verify URL, method, auth header / body field
2. **Param serialization** — verify query/body shape and that `undefined` values are skipped
3. **Vendor-level error** — non-`SUCCESS` status (or 200-with-error-body) throws with the vendor message
4. **Transport-level error** — HTTP 4xx/5xx throws with status + body text
5. **Missing env var** — throws a clear error mentioning the env var name

Use `vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(...))`. Always restore in `afterEach`.

**Gotcha: Response body streams are one-shot.** A `Response` object's body can only be read once. `mockResolvedValue(new Response(...))` returns the *same* Response instance to every fetch call, so a test that calls the API twice will hit a consumed stream on the second call and either fail strangely or hang. Two fixes:

- **Combine assertions into one regex** — `await expect(gh('/user')).rejects.toThrow(/HTTP 401.*Bad credentials/)` instead of two separate `.toThrow()` calls that each invoke the function.
- **Use `mockImplementation`** when you need genuinely independent calls: `vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(...)))` — produces a fresh Response per call.

---

## 6. README (`packages/<vendor>/README.md`)

Section order (don't reorder; users skim in order):

1. **One-paragraph what + why**
2. **3–5 example questions** — what users would actually type to Claude
3. **Tools table** — name, what it does
4. **Install** — `npx -y @zeroindex-ai/mcp-<vendor>`
5. **Configure** — where to get the API token, how to scope it, security notes (especially for high-stakes APIs like banking)
6. **Use with Claude Desktop** — full `claude_desktop_config.json` snippet, ready to paste-replace
7. **Use with Claude Code** — `claude mcp add ...` command
8. **Local development** — git clone + `pnpm --filter ... dev`
9. **Privacy / data handling** (only for vendors with sensitive data) — what's sent where, what's cached, what's logged (probably "nothing")
10. **License** — link to root LICENSE

---

## 7. Validate locally (don't push without these)

```bash
pnpm install                 # picks up the new package
pnpm typecheck               # all packages
pnpm lint
pnpm test                    # vitest across workspace
pnpm build                   # tsc per package, produces dist/
```

Then the MCP handshake smoke test against the built output:

```bash
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node packages/<vendor>/dist/index.js 2>&1 | tail -1 \
  | python3 -c "import sys, json; d = json.loads(sys.stdin.read()); [print(f'  - {t[\"name\"]}') for t in d['result']['tools']]"
```

Should print your tool names. If it prints anything else, the server didn't boot — fix before pushing.

---

## 8. Dogfood it in a real MCP client

§7's handshake smoke test confirms the server *boots*. Before shipping, confirm the tools actually *work* by loading the server into a real MCP client — Claude Desktop, Claude Code, Cursor, Zed, or any other. This is the mcp-pack philosophy in practice ("the first user is always us"): every server wraps a tool that gets exercised against real data before release.

Each client has its own config format for registering an stdio MCP server (a `command` + `args` + `env` entry pointing at the built `dist/index.js`) — see that client's docs. Supply the vendor credential via the env var the server expects, restart the client, then run the validator tool first (`ping` / `list_*` / `get_authenticated_user` — the no-arg tool each server ships for exactly this), followed by each other tool with realistic inputs.

How you store and inject the credential (plaintext in the config, a secrets-manager wrapper, an env file) is your call — the server only cares that the env var is set at spawn time.

---

## 9. Update repo-level docs

- **Root `README.md`** — bump the server table from `planned` to `✅ shipped` and link to the package README.

---

## 10. Commit, push, watch CI

Single commit covering scaffold + tools + tests + README + root-README bump:

```
Add @zeroindex-ai/mcp-<vendor> — <one-line summary>

<2-3 lines on tool surface, auth, base URL>

Verified locally: typecheck/lint/test/build clean, MCP initialize +
tools/list handshake works against built dist/index.js. README has
Claude Desktop + Claude Code config snippets.
```

CI must come back green before declaring done. Common failures:

- **`pnpm/action-setup` "multiple versions"** — the workflow `version:` conflicts with `package.json` `packageManager`. Drop the workflow `version:` field; let `packageManager` win.
- **Lint failure on a quote/apostrophe in JSX** — not relevant to MCP servers (no JSX), but a reminder to run `pnpm lint` locally before pushing.

---

## 11. Publish to npm (when ready)

This is a separate motion, not part of every-server work. Probably worth doing once 3+ servers are stable and you want public users:

```bash
# One-time: ensure @zeroindex-ai/ scope exists on npm
npm login
npm org create zeroindex-ai     # if not already

# Per-package, per-release
cd packages/<vendor>
pnpm build
npm publish                       # publishConfig.access: public is in package.json
```

Then update READMEs to use `npx -y @zeroindex-ai/mcp-<vendor>` instead of the local-path config.

---

## Reference servers

When in doubt, copy from these:

- **Porkbun** (`packages/porkbun/`) — POST-everywhere with credentials in body, single read surface, dead simple. Best template for any vendor with API-key + secret style auth.
- **Mercury** (`packages/mercury/`) — GET-everywhere with Bearer auth, query-param filtering, ID-scoped subroutes. Best template for any modern REST API.
