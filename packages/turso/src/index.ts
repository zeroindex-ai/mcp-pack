#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  tg,
  type ListDatabasesResponse,
  type GetDatabaseResponse,
  type GetDatabaseUsageResponse,
  type ListGroupsResponse,
} from './turso.js';

const server = new McpServer({
  name: '@zeroindex-ai/mcp-turso',
  version: '0.1.1',
});

server.registerTool(
  'list_databases',
  {
    title: 'List Turso databases in the organization',
    description:
      'Returns every database in the configured Turso organization, with name, region, group, and block_reads/block_writes status. Run this first to verify credentials and discover database names for the other tools. Optionally filter by group.',
    inputSchema: {
      group: z
        .string()
        .min(1)
        .optional()
        .describe('Filter databases by group name (from list_groups).'),
    },
  },
  async ({ group }) => {
    const data = await tg<ListDatabasesResponse>('/databases', { group });
    return { content: [{ type: 'text', text: JSON.stringify(data.databases, null, 2) }] };
  }
);

server.registerTool(
  'get_database',
  {
    title: 'Get one Turso database by name',
    description:
      'Returns full details for a single database: hostname, regions, primary region, group, parent (if branched), and read/write block status. Get the name from list_databases.',
    inputSchema: {
      name: z.string().min(1).describe('The Turso database name (from list_databases, "Name" field).'),
    },
  },
  async ({ name }) => {
    const data = await tg<GetDatabaseResponse>(`/databases/${encodeURIComponent(name)}`);
    return { content: [{ type: 'text', text: JSON.stringify(data.database, null, 2) }] };
  }
);

server.registerTool(
  'get_database_usage',
  {
    title: 'Get usage stats for a Turso database',
    description:
      'Returns rows read, rows written, storage bytes, and bytes synced for a database over a date range. Defaults to the current calendar month. Use this to answer cost and quota questions.',
    inputSchema: {
      name: z.string().min(1).describe('The Turso database name (from list_databases).'),
      from: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('Inclusive start instant (ISO 8601, e.g. 2026-05-01T00:00:00Z). Defaults to start of current calendar month.'),
      to: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe('Inclusive end instant (ISO 8601, e.g. 2026-05-31T23:59:59Z). Defaults to end of current calendar month.'),
    },
  },
  async ({ name, from, to }) => {
    const data = await tg<GetDatabaseUsageResponse>(
      `/databases/${encodeURIComponent(name)}/usage`,
      { from, to }
    );
    return { content: [{ type: 'text', text: JSON.stringify(data.database, null, 2) }] };
  }
);

server.registerTool(
  'list_groups',
  {
    title: 'List Turso groups in the organization',
    description:
      'Returns every group in the organization. Groups are how Turso clusters databases across regions; each database belongs to exactly one group. Useful for understanding multi-DB topology before drilling into specific databases.',
    inputSchema: {},
  },
  async () => {
    const data = await tg<ListGroupsResponse>('/groups');
    return { content: [{ type: 'text', text: JSON.stringify(data.groups, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
