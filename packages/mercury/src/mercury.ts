// Thin Mercury Treasury API v1 client.
//
// Auth: Bearer token in the Authorization header. Generate at
// app.mercury.com/settings/tokens. Tokens are read/write at the account
// level; this package uses only GET endpoints, but the token itself can
// still authorize write operations elsewhere — keep it secret.
//
// Endpoint paths verified against Mercury API v1 (stable since launch).
// The `list_accounts` tool exists precisely to validate token + network
// at runtime — call it first if anything looks off.

const BASE = 'https://api.mercury.com/api/v1';

function getToken(): string {
  const token = process.env.MERCURY_API_TOKEN;
  if (!token) {
    throw new Error('MERCURY_API_TOKEN environment variable is required');
  }
  return token;
}

export async function mg<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${getToken()}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mercury ${path} HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export type Account = {
  id: string;
  name: string;
  accountNumber: string;
  routingNumber: string;
  status: string;
  type: string;
  createdAt: string;
  availableBalance: number;
  currentBalance: number;
  kind: string;
  nickname?: string | null;
  legalBusinessName?: string;
};

export type ListAccountsResponse = { accounts: Account[] };

export type Transaction = {
  amount: number;
  bankDescription: string | null;
  counterpartyId: string | null;
  counterpartyName: string;
  counterpartyNickname: string | null;
  createdAt: string;
  dashboardLink: string;
  details: Record<string, unknown> | null;
  estimatedDeliveryDate: string | null;
  failedAt: string | null;
  feeId: string | null;
  id: string;
  kind: string;
  note: string | null;
  externalMemo: string | null;
  postedAt: string | null;
  reasonForFailure: string | null;
  status: string;
  systemTransactionId: string | null;
  attachments: unknown[];
  currencyExchangeInfo: Record<string, unknown> | null;
  compliantWithReceiptPolicy: boolean | null;
  hasGeneratedReceipt: boolean | null;
  creditAccountPeriodId: string | null;
  mercuryCategory: string | null;
  generalLedgerCodeName: string | null;
};

export type ListTransactionsResponse = { total: number; transactions: Transaction[] };
