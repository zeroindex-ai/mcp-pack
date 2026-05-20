import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './index.js';
import type { Account } from './mercury.js';

describe('mercury MCP server', () => {
  beforeEach(() => {
    process.env.MERCURY_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MERCURY_API_TOKEN;
  });

  async function connectClient() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return { client, server };
  }

  function fakeAccount(): Account {
    return {
      id: 'acc-1',
      name: 'Operating',
      accountNumber: '1234567890',
      routingNumber: '021000021',
      status: 'active',
      type: 'depository',
      createdAt: '2024-01-01T00:00:00Z',
      availableBalance: 1000,
      currentBalance: 1000,
      kind: 'checking',
    };
  }

  function fakeAccountList(): { accounts: Account[] } {
    return {
      accounts: [
        fakeAccount(),
        { ...fakeAccount(), id: 'acc-2', accountNumber: '9876543210', routingNumber: '111000025' },
      ],
    };
  }

  it('lists the expected tools', async () => {
    const { client } = await connectClient();
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(['get_account', 'list_accounts', 'list_transactions']);
  });

  it('list_accounts REDACTS accountNumber and routingNumber for every account by default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fakeAccountList())));
    const { client } = await connectClient();

    const result = await client.callTool({ name: 'list_accounts', arguments: {} });

    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const accounts = JSON.parse(text) as Account[];
    expect(accounts).toHaveLength(2);
    for (const acct of accounts) {
      expect(acct.accountNumber).toBe('***REDACTED***');
      expect(acct.routingNumber).toBe('***REDACTED***');
    }
    // Non-sensitive fields preserved.
    expect(accounts[0]!.id).toBe('acc-1');
    expect(accounts[1]!.id).toBe('acc-2');
    expect(accounts[0]!.availableBalance).toBe(1000);
    // structuredContent redacts in lock-step with text.
    const structured = result.structuredContent as { accounts: Account[] };
    expect(structured.accounts[0]!.accountNumber).toBe('***REDACTED***');
    expect(structured.accounts[1]!.routingNumber).toBe('***REDACTED***');
  });

  it('list_accounts includes raw numbers for every account when includeBankNumbers: true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fakeAccountList())));
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'list_accounts',
      arguments: { includeBankNumbers: true },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const accounts = JSON.parse(text) as Account[];
    expect(accounts[0]!.accountNumber).toBe('1234567890');
    expect(accounts[0]!.routingNumber).toBe('021000021');
    expect(accounts[1]!.accountNumber).toBe('9876543210');
    expect(accounts[1]!.routingNumber).toBe('111000025');
  });

  it('get_account REDACTS accountNumber and routingNumber by default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fakeAccount())));
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'get_account',
      arguments: { accountId: 'acc-1' },
    });

    expect(Array.isArray(result.content)).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const parsed = JSON.parse(text) as Account;
    expect(parsed.accountNumber).toBe('***REDACTED***');
    expect(parsed.routingNumber).toBe('***REDACTED***');
    // Non-sensitive fields are preserved.
    expect(parsed.id).toBe('acc-1');
    expect(parsed.availableBalance).toBe(1000);
    // structuredContent is present and redacted in lock-step with text.
    const structured = result.structuredContent as { account: Account };
    expect(structured.account.accountNumber).toBe('***REDACTED***');
    expect(structured.account.id).toBe('acc-1');
  });

  it('get_account includes raw numbers when includeBankNumbers: true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fakeAccount())));
    const { client } = await connectClient();

    const result = await client.callTool({
      name: 'get_account',
      arguments: { accountId: 'acc-1', includeBankNumbers: true },
    });

    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    const parsed = JSON.parse(text) as Account;
    expect(parsed.accountNumber).toBe('1234567890');
    expect(parsed.routingNumber).toBe('021000021');
  });
});
