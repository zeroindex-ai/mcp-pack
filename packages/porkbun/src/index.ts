#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { pb, type PingResponse, type ListAllResponse, type RetrieveResponse } from './porkbun.js';

const server = new McpServer({
  name: '@zeroindex-ai/mcp-porkbun',
  version: '0.1.1',
});

server.registerTool(
  'ping',
  {
    title: 'Verify Porkbun credentials',
    description:
      'Pings the Porkbun API to verify the configured credentials work. Returns the calling IP on success. Run this first if anything looks broken.',
    inputSchema: {},
  },
  async () => {
    const data = await pb<PingResponse>('/ping');
    return { content: [{ type: 'text', text: `OK — your IP is ${data.yourIp}` }] };
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
  },
  async ({ start, includeLabels }) => {
    const body: Record<string, unknown> = {};
    if (start !== undefined) body.start = String(start);
    if (includeLabels) body.includeLabels = 'yes';
    const data = await pb<ListAllResponse>('/domain/listAll', body);
    return { content: [{ type: 'text', text: JSON.stringify(data.domains, null, 2) }] };
  }
);

server.registerTool(
  'list_dns_records',
  {
    title: 'List DNS records for a domain',
    description:
      'Returns every DNS record (A, AAAA, CNAME, MX, TXT, etc.) for the given Porkbun-managed domain. The domain must be in your account.',
    inputSchema: {
      domain: z
        .string()
        .min(3)
        .describe('Fully-qualified domain to query, e.g. "zeroindex.ai".'),
    },
  },
  async ({ domain }) => {
    const data = await pb<RetrieveResponse>(`/dns/retrieve/${encodeURIComponent(domain)}`);
    return { content: [{ type: 'text', text: JSON.stringify(data.records, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
