# @zeroindex-ai/mcp-github-org

MCP server exposing **read-only** GitHub APIs to Claude Desktop, Claude Code, Cursor, Zed, and any other [Model Context Protocol](https://modelcontextprotocol.io) client.

Lets you ask things like:

- *"List all repos in the zeroindex-ai org with their last push dates."*
- *"What pull requests are open across my repos?"*
- *"Show recent CI runs for ask-zeroindex — any failures this week?"*
- *"List open issues on mcp-pack."*

## Tools

| Tool | What it does |
|---|---|
| `get_authenticated_user` | Returns the token owner, plan info, and repo counts. **Run this first** — it doubles as the credential check. |
| `list_org_repos` | Repositories in the given org (filter by type/sort/page). |
| `list_pull_requests` | PRs for a repo (filter by state: open / closed / all). |
| `list_issues` | Issues for a repo (PRs are excluded). |
| `list_workflow_runs` | Recent GitHub Actions runs (filter by workflow file, branch, event, status). |

All five are **read-only**. Mutating tools (create issue, close PR, manage secrets) deliberately omitted in v0.1.

## Install

```bash
npx -y @zeroindex-ai/mcp-github-org
```

## Configure

You need a GitHub Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens). Two flavors:

- **Classic PAT** — easier to set up; scopes are broad. For an org you own, this works fine. Required scopes for read-only use here:
  - `repo` (read access to your repos, including private)
  - `read:org` (read org membership/repos)
  - `workflow` (read GitHub Actions runs)
- **Fine-grained PAT** — better security boundary; scope to specific repos/orgs. Required permissions:
  - Repository: Actions (read), Contents (read), Issues (read), Metadata (read), Pull requests (read)
  - Organization: Members (read)

Name it `claude-mcp-<host>` (replace `<host>` with your machine's hostname) so it can be revoked independently of other tokens. Set as `GITHUB_TOKEN` in your MCP client config.

## Use with Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "github-org": {
      "command": "npx",
      "args": ["-y", "@zeroindex-ai/mcp-github-org"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

If you'd rather not paste the token into the config file, you can inject it at spawn time from a secrets manager. The 1Password CLI variant:

```json
{
  "mcpServers": {
    "github-org": {
      "command": "op",
      "args": [
        "run",
        "--no-masking",
        "--",
        "npx",
        "-y",
        "@zeroindex-ai/mcp-github-org"
      ],
      "env": {
        "GITHUB_TOKEN": "op://<your-vault>/<your-item>/credential"
      }
    }
  }
}
```

Restart Claude Desktop (`Cmd+Q` then reopen). Then ask:

> Use the github-org get_authenticated_user tool to verify credentials.

## Use with Claude Code

```bash
claude mcp add github-org \
  --env GITHUB_TOKEN=ghp_xxxx \
  -- npx -y @zeroindex-ai/mcp-github-org
```

## Local development

```bash
git clone https://github.com/zeroindex-ai/mcp-pack
cd mcp-pack
pnpm install
GITHUB_TOKEN=ghp_xxxx pnpm --filter @zeroindex-ai/mcp-github-org dev
```

## Privacy / data handling

This server makes outbound HTTPS calls to `api.github.com` only. It stores nothing locally, holds no cache, and emits no telemetry. Read-only by design, but **the token itself authorizes writes** across your account — it's the same credential used by `gh` CLI and CI. Treat it like an admin credential: prefer a fine-grained PAT scoped only to the repos/orgs you need, name it `claude-mcp-<host>` so you can revoke it independently, and rotate at the first sign of exposure.

Data that flows through this process when tools are called: repo metadata (names, descriptions, languages), PR titles + bodies + commit refs, issue titles + bodies + labels + assignees, workflow run status. Pick your MCP client (and the LLM behind it) accordingly.

## License

MIT — see [LICENSE](../../LICENSE) at the monorepo root.
