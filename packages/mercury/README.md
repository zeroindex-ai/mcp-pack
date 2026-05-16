# @zeroindex-ai/mcp-mercury

MCP server exposing **read-only** [Mercury](https://mercury.com) banking APIs to Claude Desktop, Claude Code, Cursor, Zed, and any other [Model Context Protocol](https://modelcontextprotocol.io) client.

Lets you ask things like:

- _"List my Mercury accounts and current balances."_
- _"Show me my checking-account transactions from last month."_
- _"What's the largest expense in my treasury account this quarter?"_
- _"How much did I spend on Anthropic in May?"_

## Tools

| Tool                | What it does                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_accounts`     | Returns every account in your Mercury workspace (checking, treasury, credit cards) with balances. **Run this first** — it doubles as the credential check and surfaces account IDs for the other tools. |
| `get_account`       | Returns full details for one account by ID.                                                                                                                                                             |
| `list_transactions` | Returns transactions for an account, filterable by date range (`YYYY-MM-DD`) and paginated via `limit` / `offset`.                                                                                      |

All three are **read-only**. No transfers, no recipient management, no destructive actions. Mutating tools deliberately omitted; coming in a later release behind an explicit opt-in.

## Privacy

This is a banking server. Two specifics worth stating before you wire it up:

- **ACH account and routing numbers are REDACTED by default.** `get_account` returns `accountNumber` and `routingNumber` as `"***REDACTED***"` unless the caller explicitly passes `includeBankNumbers: true`. The default keeps the raw ACH digits from being piped into your LLM context just because the model decided to look up an account. Set the flag to `true` only when the user has actually asked to see the numbers.
- **Your Mercury API token authorizes writes**, even though this package only calls GET endpoints. Treat it like a banking credential: keep it out of source control, rotate if exposed, and use a dedicated token for this MCP server (not your one general-purpose token).
- **Data flow.** Mercury → this process → your MCP client → the LLM you've configured. Nothing is cached, persisted, or logged by this server. Pick your LLM client accordingly.

## Install

```bash
npx -y @zeroindex-ai/mcp-mercury
```

## Configure

You need a Mercury API token. Generate one at [app.mercury.com/settings/tokens](https://app.mercury.com/settings/tokens). See the [Privacy](#privacy) section above for handling guidance.

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

## Network

Outbound HTTPS calls are made to `api.mercury.com` only. No telemetry; nothing else leaves the process. See [Privacy](#privacy) above for the data-handling specifics.

## License

MIT — see [LICENSE](../../LICENSE) at the monorepo root.
