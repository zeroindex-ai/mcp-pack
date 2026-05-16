# mcp-pack

Open-source [Model Context Protocol](https://modelcontextprotocol.io) servers for solo founders and small teams running a stack of SaaS tools. By [ZeroIndex LLC](https://zeroindex.ai).

Each server is a small, narrowly-scoped wrapper around one third-party API, designed to be `npx`-runnable and dropped into Claude Desktop, Claude Code, Cursor, Zed, or any other MCP client.

## Servers

| Package                                               | Wraps                                | npm                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`@zeroindex-ai/mcp-porkbun`](packages/porkbun)       | Porkbun (domains + DNS)              | [![npm](https://img.shields.io/npm/v/@zeroindex-ai/mcp-porkbun.svg)](https://www.npmjs.com/package/@zeroindex-ai/mcp-porkbun)       |
| [`@zeroindex-ai/mcp-mercury`](packages/mercury)       | Mercury (banking, read-only)         | [![npm](https://img.shields.io/npm/v/@zeroindex-ai/mcp-mercury.svg)](https://www.npmjs.com/package/@zeroindex-ai/mcp-mercury)       |
| [`@zeroindex-ai/mcp-github-org`](packages/github-org) | GitHub (repos, PRs, issues, Actions) | [![npm](https://img.shields.io/npm/v/@zeroindex-ai/mcp-github-org.svg)](https://www.npmjs.com/package/@zeroindex-ai/mcp-github-org) |
| [`@zeroindex-ai/mcp-turso`](packages/turso)           | Turso (databases, groups, usage)     | [![npm](https://img.shields.io/npm/v/@zeroindex-ai/mcp-turso.svg)](https://www.npmjs.com/package/@zeroindex-ai/mcp-turso)           |

## Install

Each server is `npx`-runnable — no clone or build needed:

```bash
npx -y @zeroindex-ai/mcp-porkbun       # or mcp-mercury, mcp-github-org, mcp-turso
```

See each package's README for configuration (required env vars) and `claude_desktop_config.json` snippets.

## Philosophy

- **Narrow surface per server.** One vendor, a handful of well-named tools, no kitchen sink.
- **Dogfoodable.** Each server wraps a tool we use ourselves, so the first user is always us.
- **Read-first.** Initial releases expose read-only tools. Mutating tools land in later versions once the read surface has stabilized.
- **No magic.** Tools are typed with Zod, errors propagate plainly, no hidden retries that hide vendor failures.

## Repo layout

```
mcp-pack/
├── packages/
│   ├── porkbun/             # @zeroindex-ai/mcp-porkbun
│   ├── mercury/             # @zeroindex-ai/mcp-mercury
│   ├── github-org/          # @zeroindex-ai/mcp-github-org
│   └── turso/               # @zeroindex-ai/mcp-turso
├── package.json             # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
└── .github/workflows/ci.yml
```

## Develop

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

To run a server locally during development:

```bash
PORKBUN_API_KEY=pk1_... PORKBUN_SECRET_API_KEY=sk1_... \
  pnpm --filter @zeroindex-ai/mcp-porkbun dev
```

## License

MIT — see [LICENSE](LICENSE).
