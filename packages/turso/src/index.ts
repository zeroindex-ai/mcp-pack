#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
import {
  tg,
  type ListDatabasesResponse,
  type GetDatabaseResponse,
  type GetDatabaseUsageResponse,
  type ListGroupsResponse,
} from './turso.js';

// Permissive outputSchema shapes — vendor APIs drift; we keep these loose so
// harmless additions don't break tool calls. Turso uses PascalCase keys on
// Database; the structured projection normalises to lowercase for client
// consumption while the text body keeps the raw vendor shape.
const listDatabasesOutput = z.object({
  databases: z.array(
    z
      .object({
        name: z.string(),
        hostname: z.string().optional(),
        region: z.string().optional(),
      })
      .passthrough()
  ),
});

const getDatabaseOutput = z.object({
  database: z
    .object({
      name: z.string(),
      hostname: z.string().optional(),
      region: z.string().optional(),
    })
    .passthrough(),
});

const getDatabaseUsageOutput = z.object({
  usage: z
    .object({
      rows_read: z.number().optional(),
      rows_written: z.number().optional(),
      storage_bytes: z.number().optional(),
      bytes_synced: z.number().optional(),
    })
    .passthrough(),
});

const listGroupsOutput = z.object({
  groups: z.array(
    z
      .object({
        name: z.string(),
        primary: z.string().optional(),
        locations: z.array(z.string()).optional(),
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
    'list_databases',
    {
      title: 'List Turso databases in the organization',
      description:
        'Returns every database in the configured Turso organization, with name, region, group, and block_reads/block_writes status. Run this first to verify credentials and discover database names for the other tools. Optionally filter by group.',
      inputSchema: {
        group: z.string().min(1).optional().describe('Filter databases by group name (from list_groups).'),
      },
      outputSchema: listDatabasesOutput.shape,
    },
    async ({ group }) => {
      const data = await tg<ListDatabasesResponse>('/databases', { group });
      const databases = data.databases.map((d) => ({
        name: d.Name,
        hostname: d.Hostname,
        region: d.primaryRegion,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(data.databases, null, 2) }],
        structuredContent: { databases },
      };
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
      outputSchema: getDatabaseOutput.shape,
    },
    async ({ name }) => {
      const data = await tg<GetDatabaseResponse>(`/databases/${encodeURIComponent(name)}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(data.database, null, 2) }],
        structuredContent: {
          database: {
            name: data.database.Name,
            hostname: data.database.Hostname,
            region: data.database.primaryRegion,
          },
        },
      };
    }
  );

  server.registerTool(
    'get_database_usage',
    {
      title: 'Get usage stats for a Turso database',
      description:
        "Returns rows read, rows written, storage bytes, and bytes synced for a database over a date range. Omit from/to to use the Turso API's own default window. Use this to answer cost and quota questions.",
      inputSchema: {
        name: z.string().min(1).describe('The Turso database name (from list_databases).'),
        from: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe(
            'Inclusive start instant (ISO 8601, e.g. 2026-05-01T00:00:00Z). Omit to let the Turso API choose the start of its default window.'
          ),
        to: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe(
            'Inclusive end instant (ISO 8601, e.g. 2026-05-31T23:59:59Z). Omit to let the Turso API choose the end of its default window.'
          ),
      },
      outputSchema: getDatabaseUsageOutput.shape,
    },
    async ({ name, from, to }) => {
      const data = await tg<GetDatabaseUsageResponse>(`/databases/${encodeURIComponent(name)}/usage`, {
        from,
        to,
      });
      // Deliberate content/structuredContent projection: the text `content`
      // carries the full vendor payload (per-instance breakdown plus the
      // rollup), while `structuredContent` exposes only `data.database.total`.
      // Programmatic consumers get a stable total for cost/quota questions; the
      // richer per-instance detail stays available as text for the LLM.
      return {
        content: [{ type: 'text', text: JSON.stringify(data.database, null, 2) }],
        structuredContent: { usage: data.database.total },
      };
    }
  );

  server.registerTool(
    'list_groups',
    {
      title: 'List Turso groups in the organization',
      description:
        'Returns every group in the organization. Groups are how Turso clusters databases across regions; each database belongs to exactly one group. Useful for understanding multi-DB topology before drilling into specific databases.',
      inputSchema: {},
      outputSchema: listGroupsOutput.shape,
    },
    async () => {
      const data = await tg<ListGroupsResponse>('/groups');
      const groups = data.groups.map((g) => ({
        name: g.name,
        primary: g.primary,
        locations: g.locations,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(data.groups, null, 2) }],
        structuredContent: { groups },
      };
    }
  );

  return server;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
