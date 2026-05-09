# @zeroindex-ai/mcp-turso

MCP server exposing **read-only** [Turso](https://turso.tech) Platform APIs to Claude Desktop, Claude Code, Cursor, Zed, and any other [Model Context Protocol](https://modelcontextprotocol.io) client.

Lets you ask things like:

- *"List my Turso databases and which group each is in."*
- *"How many rows did `prod-app` read this month?"*
- *"Am I close to the storage cap on my hobby tier?"*
- *"Which databases live in the `default` group?"*

## Tools

| Tool | What it does |
|---|---|
| `list_databases` | Returns every database in the configured Turso organization (name, hostname, regions, group, read/write block status). **Run this first** — it doubles as the credential check and surfaces the names every other tool needs. Optional `group` filter. |
| `get_database` | Returns full details for a single database by name. |
| `get_database_usage` | Returns `rows_read`, `rows_written`, `storage_bytes`, and `bytes_synced` for a database over a date range (ISO 8601 UTC). Defaults to the current calendar month. The killer tool for cost / quota questions. |
| `list_groups` | Returns every group in the organization. Groups cluster databases across regions; each database belongs to exactly one. |

All four are **read-only**. No database creation, no token rotation, no destructive actions. Mutating tools deliberately omitted; coming in a later release behind an explicit opt-in. The libSQL query API (running `SELECT` against your actual data) is intentionally not in this package — that's a separate concern with a different auth flow.

## Install

```bash
npx -y @zeroindex-ai/mcp-turso
```

## Configure

You need two things:

1. **An API token.** Mint one via the Turso CLI:

   ```bash
   turso auth api-tokens mint claude-mcp-$(hostname -s)
   ```

   Or generate one in the dashboard at [app.turso.tech](https://app.turso.tech) under Settings → API Tokens. The token authorizes the Platform API across your entire organization (including create/delete on databases and groups), so even though this package only exercises GET endpoints, **treat the token like an admin credential** — keep it out of source control, rotate if exposed, and use a dedicated token for this MCP server.

2. **Your organization slug.** Visible in your dashboard URL (`app.turso.tech/<slug>`) or via `turso org list`. Personal accounts have an org slug equal to your username.

Set both as env vars in your MCP client config (next section):

- `TURSO_API_TOKEN`
- `TURSO_ORG_SLUG`

## Use with Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "turso": {
      "command": "npx",
      "args": ["-y", "@zeroindex-ai/mcp-turso"],
      "env": {
        "TURSO_API_TOKEN": "your-platform-token",
        "TURSO_ORG_SLUG": "your-org-slug"
      }
    }
  }
}
```

Restart Claude Desktop (`Cmd+Q` and reopen — closing the window doesn't reload the config). Then ask:

> Use the turso list_databases tool to verify credentials and show what I have running.

## Use with Claude Code

```bash
claude mcp add turso \
  --env TURSO_API_TOKEN=your-platform-token \
  --env TURSO_ORG_SLUG=your-org-slug \
  -- npx -y @zeroindex-ai/mcp-turso
```

## Local development

```bash
git clone https://github.com/zeroindex-ai/mcp-pack
cd mcp-pack
pnpm install
TURSO_API_TOKEN=... TURSO_ORG_SLUG=... pnpm --filter @zeroindex-ai/mcp-turso dev
```

## Privacy / data handling

This server makes outbound HTTPS calls to `api.turso.tech` only. It stores nothing locally, holds no cache, and emits no telemetry. It does **not** connect to your individual libSQL databases — only the Platform API — so the actual data inside your databases never flows through this process. Metadata that does flow: database names, hostnames, regions, group membership, and aggregate usage counters. Pick your MCP client (and the LLM behind it) accordingly.

## License

MIT — see [LICENSE](../../LICENSE) at the monorepo root.
