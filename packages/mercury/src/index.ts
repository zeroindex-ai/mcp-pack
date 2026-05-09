#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mg, type Account, type ListAccountsResponse, type ListTransactionsResponse } from './mercury.js';

const server = new McpServer({
  name: '@zeroindex-ai/mcp-mercury',
  version: '0.1.1',
});

server.registerTool(
  'list_accounts',
  {
    title: 'List all Mercury accounts',
    description:
      'Returns every account in the authenticated Mercury workspace — checking, treasury, credit cards — with current and available balances. Run this first to verify credentials and discover account IDs for the other tools.',
    inputSchema: {},
  },
  async () => {
    const data = await mg<ListAccountsResponse>('/accounts');
    return { content: [{ type: 'text', text: JSON.stringify(data.accounts, null, 2) }] };
  }
);

server.registerTool(
  'get_account',
  {
    title: 'Get one Mercury account by ID',
    description:
      'Returns full details for a single account: balances, status, account/routing numbers, kind. Get the ID from list_accounts.',
    inputSchema: {
      accountId: z.string().min(1).describe('The Mercury account ID (UUID, from list_accounts).'),
    },
  },
  async ({ accountId }) => {
    const data = await mg<Account>(`/account/${encodeURIComponent(accountId)}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  'list_transactions',
  {
    title: 'List transactions for a Mercury account',
    description:
      'Returns transactions for the given account. Filter by date range (YYYY-MM-DD) and paginate via limit/offset. Default page size is the Mercury server default (typically 500).',
    inputSchema: {
      accountId: z.string().min(1).describe('The Mercury account ID (UUID, from list_accounts).'),
      start: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .optional()
        .describe('Inclusive start date for postedAt filter, e.g. "2026-01-01".'),
      end: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .optional()
        .describe('Inclusive end date for postedAt filter, e.g. "2026-01-31".'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe('Maximum transactions to return (1–500).'),
      offset: z.number().int().min(0).optional().describe('Pagination offset (default 0).'),
    },
  },
  async ({ accountId, start, end, limit, offset }) => {
    const data = await mg<ListTransactionsResponse>(
      `/account/${encodeURIComponent(accountId)}/transactions`,
      { start, end, limit, offset }
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ total: data.total, count: data.transactions.length, transactions: data.transactions }, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
