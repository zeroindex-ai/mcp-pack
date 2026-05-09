# @zeroindex-ai/mcp-porkbun

MCP server exposing [Porkbun](https://porkbun.com)'s domain and DNS APIs to Claude Desktop, Claude Code, Cursor, Zed, and any other [Model Context Protocol](https://modelcontextprotocol.io) client.

Lets you ask things like:

- *"List all my domains and their expiry dates."*
- *"Show me every DNS record on zeroindex.ai."*
- *"Which of my domains expire in the next 90 days?"*

## Tools

| Tool | What it does |
|---|---|
| `ping` | Verifies your Porkbun API credentials work; returns the calling IP. Run this first if anything looks broken. |
| `list_domains` | Returns every domain in the account with status, expiry, auto-renew, and (optionally) labels. Supports pagination. |
| `list_dns_records` | Returns every DNS record (A, AAAA, CNAME, MX, TXT, etc.) for a given domain. |

All three are read-only. Mutating tools (renew, edit DNS) deliberately omitted in v0.1; coming in a later release.

## Install

The server runs via `npx` — no permanent install needed:

```bash
npx -y @zeroindex-ai/mcp-porkbun
```

## Configure

You need a Porkbun API key pair. Create one at [porkbun.com/account/api](https://porkbun.com/account/api) and **enable API access on each domain you want the server to see** (Domain Management → click the domain → "API ACCESS" toggle).

Set both keys as environment variables in your MCP client config (next section).

## Use with Claude Desktop

Add this to your `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "porkbun": {
      "command": "npx",
      "args": ["-y", "@zeroindex-ai/mcp-porkbun"],
      "env": {
        "PORKBUN_API_KEY": "pk1_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "PORKBUN_SECRET_API_KEY": "sk1_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop. Then ask:

> Use the porkbun ping tool to confirm credentials are working.

If `ping` returns your IP, the other two tools are ready to use.

## Use with Claude Code

```bash
claude mcp add porkbun \
  --env PORKBUN_API_KEY=pk1_xxxx \
  --env PORKBUN_SECRET_API_KEY=sk1_xxxx \
  -- npx -y @zeroindex-ai/mcp-porkbun
```

## Local development

```bash
git clone https://github.com/zeroindex-ai/mcp-pack
cd mcp-pack
pnpm install
PORKBUN_API_KEY=pk1_... PORKBUN_SECRET_API_KEY=sk1_... pnpm --filter @zeroindex-ai/mcp-porkbun dev
```

## License

MIT — see [LICENSE](../../LICENSE) at the monorepo root.
