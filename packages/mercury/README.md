# @zeroindex-ai/mcp-mercury

MCP server exposing **read-only** [Mercury](https://mercury.com) banking APIs to Claude Desktop, Claude Code, Cursor, Zed, and any other [Model Context Protocol](https://modelcontextprotocol.io) client.

Lets you ask things like:

- *"List my Mercury accounts and current balances."*
- *"Show me my checking-account transactions from last month."*
- *"What's the largest expense in my treasury account this quarter?"*
- *"How much did I spend on Anthropic in May?"*

## Tools

| Tool | What it does |
|---|---|
| `list_accounts` | Returns every account in your Mercury workspace (checking, treasury, credit cards) with balances. **Run this first** — it doubles as the credential check and surfaces account IDs for the other tools. |
| `get_account` | Returns full details for one account by ID. |
| `list_transactions` | Returns transactions for an account, filterable by date range (`YYYY-MM-DD`) and paginated via `limit` / `offset`. |

All three are **read-only**. No transfers, no recipient management, no destructive actions. Mutating tools deliberately omitted; coming in a later release behind an explicit opt-in.

## Install

```bash
npx -y @zeroindex-ai/mcp-mercury
```

## Configure

You need a Mercury API token. Generate one at [app.mercury.com/settings/tokens](https://app.mercury.com/settings/tokens). The token authorizes both reads and writes across all accounts on your workspace, so even though this package only exercises the read endpoints, **treat the token like a banking credential** — keep it out of source control, rotate if exposed, and use a dedicated token for this MCP server (not your one general-purpose token).

Set as `MERCURY_API_TOKEN` in your MCP client config (next section).

## Use with Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mercury": {
      "command": "npx",
      "args": ["-y", "@zeroindex-ai/mcp-mercury"],
      "env": {
        "MERCURY_API_TOKEN": "secret-token-xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop (`Cmd+Q` and reopen — closing the window doesn't reload the config). Then ask:

> Use the mercury list_accounts tool to verify credentials and show my balances.

## Use with Claude Code

```bash
claude mcp add mercury \
  --env MERCURY_API_TOKEN=secret-token-xxxxxxxxxxxxxxxx \
  -- npx -y @zeroindex-ai/mcp-mercury
```

## Local development

```bash
git clone https://github.com/zeroindex-ai/mcp-pack
cd mcp-pack
pnpm install
MERCURY_API_TOKEN=secret-token-xxxx pnpm --filter @zeroindex-ai/mcp-mercury dev
```

## Privacy / data handling

This server makes outbound HTTPS calls to `api.mercury.com` only. It stores nothing locally, holds no cache, and emits no telemetry. Your transaction data flows: Mercury → this process → your MCP client → the LLM you've configured. Pick your LLM client accordingly.

## License

MIT — see [LICENSE](../../LICENSE) at the monorepo root.
