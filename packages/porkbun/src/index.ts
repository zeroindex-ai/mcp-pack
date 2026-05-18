#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
import { pb, type PingResponse, type ListAllResponse, type RetrieveResponse } from './porkbun.js';

// Permissive outputSchema shapes — vendor APIs drift; we keep these loose
// (lots of `.optional()`) so harmless additions don't break tool calls.
const pingOutput = z.object({
  ok: z.boolean(),
  yourIp: z.string().optional(),
});

const listDomainsOutput = z.object({
  domains: z.array(
    z
      .object({
        domain: z.string(),
        status: z.string(),
        tld: z.string().optional(),
        createDate: z.string().optional(),
        expireDate: z.string().optional(),
      })
      .passthrough()
  ),
});

const listDnsRecordsOutput = z.object({
  records: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        content: z.string(),
        ttl: z.string().optional(),
      })
      .passthrough()
  ),
});

export function createServer(): McpServer {
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  server.registerTool(
    'ping',
    {
      title: 'Verify Porkbun credentials',
      description:
        'Pings the Porkbun API to verify the configured credentials work. Returns the calling IP on success. Run this first if anything looks broken.',
      inputSchema: {},
      outputSchema: pingOutput.shape,
    },
    async () => {
      const data = await pb<PingResponse>('/ping');
      const structured = { ok: true, yourIp: data.yourIp };
      return {
        content: [{ type: 'text', text: `OK — your IP is ${data.yourIp}` }],
        structuredContent: structured,
      };
    }
  );

  server.registerTool(
    'list_domains',
    {
      title: 'List all domains in account',
      description:
        'Returns every domain owned by the authenticated Porkbun account, including expiry date, status, auto-renew, and WHOIS privacy. Pagination via `start` (offset).',
      inputSchema: {
        start: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Pagination offset (default 0). Porkbun returns up to 1000 per page.'),
        includeLabels: z
          .boolean()
          .optional()
          .describe('Include label metadata for each domain (default false).'),
      },
      outputSchema: listDomainsOutput.shape,
    },
    async ({ start, includeLabels }) => {
      const body: Record<string, unknown> = {};
      if (start !== undefined) body.start = String(start);
      if (includeLabels) body.includeLabels = 'yes';
      const data = await pb<ListAllResponse>('/domain/listAll', body);
      return {
        content: [{ type: 'text', text: JSON.stringify(data.domains, null, 2) }],
        structuredContent: { domains: data.domains },
      };
    }
  );

  server.registerTool(
    'list_dns_records',
    {
      title: 'List DNS records for a domain',
      description:
        'Returns every DNS record (A, AAAA, CNAME, MX, TXT, etc.) for the given Porkbun-managed domain. The domain must be in your account.',
      inputSchema: {
        domain: z.string().min(3).describe('Fully-qualified domain to query, e.g. "zeroindex.ai".'),
      },
      outputSchema: listDnsRecordsOutput.shape,
    },
    async ({ domain }) => {
      const data = await pb<RetrieveResponse>(`/dns/retrieve/${encodeURIComponent(domain)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data.records, null, 2) }],
        structuredContent: { records: data.records },
      };
    }
  );

  return server;
}

// Only auto-connect over stdio when run as the bin entrypoint, not when
// imported by tests.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
