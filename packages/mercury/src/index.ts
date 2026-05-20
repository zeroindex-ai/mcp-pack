#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import pkg from '../package.json' with { type: 'json' };
import { mg, type Account, type ListAccountsResponse, type ListTransactionsResponse } from './mercury.js';

// Sensitive ACH fields are replaced with this sentinel before any account
// leaves the process, unless the caller explicitly opts in. Applied uniformly
// by both list_accounts and get_account so the redaction promise holds for the
// first call the README tells users to make.
const REDACTED = '***REDACTED***';

function redactAccount(account: Account): Account {
  return { ...account, accountNumber: REDACTED, routingNumber: REDACTED };
}

// Permissive outputSchema shapes — vendor APIs drift; we keep these loose so
// harmless additions don't break tool calls.
const listAccountsOutput = z.object({
  accounts: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        kind: z.string().optional(),
        status: z.string().optional(),
      })
      .passthrough()
  ),
});

const getAccountOutput = z.object({
  account: z
    .object({
      id: z.string(),
      name: z.string(),
      accountNumber: z.string().optional(),
      routingNumber: z.string().optional(),
    })
    .passthrough(),
});

const listTransactionsOutput = z
  .object({
    transactions: z.array(
      z
        .object({
          id: z.string(),
          amount: z.number(),
          counterpartyName: z.string().optional(),
          createdAt: z.string().optional(),
          status: z.string().optional(),
        })
        .passthrough()
    ),
  })
  .passthrough();

export function createServer(): McpServer {
  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  server.registerTool(
    'list_accounts',
    {
      title: 'List all Mercury accounts',
      description:
        'Returns every account in the authenticated Mercury workspace — checking, treasury, credit cards — with current and available balances. Run this first to verify credentials and discover account IDs for the other tools. By default the ACH account and routing numbers on each account are REDACTED before the response is returned to the LLM — pass includeBankNumbers: true to receive the real values.',
      inputSchema: {
        includeBankNumbers: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, ACH accountNumber and routingNumber are included verbatim for every account. Defaults to false, which replaces both fields with "***REDACTED***" before the data leaves this process. Only set true when the user has explicitly asked to see the raw numbers.'
          ),
      },
      outputSchema: listAccountsOutput.shape,
    },
    async ({ includeBankNumbers }) => {
      const data = await mg<ListAccountsResponse>('/accounts');
      const accounts = includeBankNumbers ? data.accounts : data.accounts.map(redactAccount);
      return {
        content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }],
        structuredContent: { accounts },
      };
    }
  );

  server.registerTool(
    'get_account',
    {
      title: 'Get one Mercury account by ID',
      description:
        'Returns details for a single account: balances, status, kind, and (when explicitly requested) ACH account/routing numbers. By default the ACH account and routing numbers are REDACTED before the response is returned to the LLM — pass includeBankNumbers: true to receive the real values. Get the account ID from list_accounts.',
      inputSchema: {
        accountId: z.string().min(1).describe('The Mercury account ID (UUID, from list_accounts).'),
        includeBankNumbers: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, ACH accountNumber and routingNumber are included verbatim in the response. Defaults to false, which replaces both fields with "***REDACTED***" before the data leaves this process. Only set true when the user has explicitly asked to see the raw numbers.'
          ),
      },
      outputSchema: getAccountOutput.shape,
    },
    async ({ accountId, includeBankNumbers }) => {
      const data = await mg<Account>(`/account/${encodeURIComponent(accountId)}`);
      const payload: Account = includeBankNumbers ? data : redactAccount(data);
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: { account: payload },
      };
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
      outputSchema: listTransactionsOutput.shape,
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
            text: JSON.stringify(
              {
                total: data.total,
                count: data.transactions.length,
                transactions: data.transactions,
              },
              null,
              2
            ),
          },
        ],
        structuredContent: { transactions: data.transactions },
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
