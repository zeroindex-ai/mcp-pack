// Vendor-type drift guard.
//
// The Mercury client hand-types the vendor's JSON shapes (Account,
// Transaction) in mercury.ts. The live API can silently add/rename/retype
// fields, leaving our hand-typed shapes wrong without anything failing.
//
// These tests parse a committed, *fully sanitized* fixture (no real account
// numbers, balances, tokens, or counterparty names — all placeholder values)
// through Zod schemas that mirror the hand-typed shapes. If someone changes a
// hand-typed shape incompatibly (drops a field, retypes one), the matching
// schema below must change too — and the runtime parse + projection-key
// assertions below will fail if the schema stops matching the fixture.
//
// The `satisfies z.ZodType<Account>` / `<Transaction>` annotations tie each
// schema to the hand-typed type at compile time: if the type changes shape,
// the schema annotation stops compiling, forcing this guard to be updated in
// lock-step with the type.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { Account, Transaction } from './mercury.js';

function loadFixture(name: string): unknown {
  const url = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

// Mirror of the hand-typed `Account`. `satisfies z.ZodType<Account>` makes the
// compiler reject this if the schema and the type drift apart.
const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountNumber: z.string(),
  routingNumber: z.string(),
  status: z.string(),
  type: z.string(),
  createdAt: z.string(),
  availableBalance: z.number(),
  currentBalance: z.number(),
  kind: z.string(),
  nickname: z.string().nullable().optional(),
  legalBusinessName: z.string().optional(),
}) satisfies z.ZodType<Account>;

const listAccountsSchema = z.object({ accounts: z.array(accountSchema) });

// Mirror of the hand-typed `Transaction`.
const transactionSchema = z.object({
  amount: z.number(),
  bankDescription: z.string().nullable(),
  counterpartyId: z.string().nullable(),
  counterpartyName: z.string(),
  counterpartyNickname: z.string().nullable(),
  createdAt: z.string(),
  dashboardLink: z.string(),
  details: z.record(z.unknown()).nullable(),
  estimatedDeliveryDate: z.string().nullable(),
  failedAt: z.string().nullable(),
  feeId: z.string().nullable(),
  id: z.string(),
  kind: z.string(),
  note: z.string().nullable(),
  externalMemo: z.string().nullable(),
  postedAt: z.string().nullable(),
  reasonForFailure: z.string().nullable(),
  status: z.string(),
  systemTransactionId: z.string().nullable(),
  attachments: z.array(z.unknown()),
  currencyExchangeInfo: z.record(z.unknown()).nullable(),
  compliantWithReceiptPolicy: z.boolean().nullable(),
  hasGeneratedReceipt: z.boolean().nullable(),
  creditAccountPeriodId: z.string().nullable(),
  mercuryCategory: z.string().nullable(),
  generalLedgerCodeName: z.string().nullable(),
}) satisfies z.ZodType<Transaction>;

const listTransactionsSchema = z.object({
  total: z.number(),
  transactions: z.array(transactionSchema),
});

describe('mercury vendor-type contract', () => {
  it('list-accounts fixture parses through the hand-typed Account schema', () => {
    const parsed = listAccountsSchema.parse(loadFixture('list-accounts.json'));
    expect(parsed.accounts.length).toBeGreaterThan(0);

    // The list_accounts tool projects raw vendor accounts straight through; the
    // hand-typed Account fields the README/redaction logic relies on must exist.
    const account: Account = parsed.accounts[0]!;
    expect(Object.keys(account)).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'accountNumber',
        'routingNumber',
        'status',
        'kind',
        'availableBalance',
        'currentBalance',
      ])
    );
  });

  it('list-transactions fixture parses through the hand-typed Transaction schema', () => {
    const parsed = listTransactionsSchema.parse(loadFixture('list-transactions.json'));
    expect(parsed.transactions.length).toBeGreaterThan(0);
    expect(typeof parsed.total).toBe('number');

    // list_transactions exposes the full transaction objects; the fields callers
    // filter/render on must be present in the mapped projection.
    const tx: Transaction = parsed.transactions[0]!;
    expect(Object.keys(tx)).toEqual(
      expect.arrayContaining(['id', 'amount', 'counterpartyName', 'createdAt', 'status', 'kind', 'postedAt'])
    );
  });

  it('rejects a fixture whose field is the wrong type (proves the guard bites)', () => {
    const broken = loadFixture('list-accounts.json') as { accounts: unknown[] };
    (broken.accounts[0] as Record<string, unknown>).availableBalance = 'not-a-number';
    expect(() => listAccountsSchema.parse(broken)).toThrow();
  });
});
