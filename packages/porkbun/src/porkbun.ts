// Thin Porkbun JSON v3 client.
//
// Auth: every request is a POST with apikey + secretapikey merged into the
// JSON body (Porkbun's design — credentials go in the body, not headers).
// The shared @zeroindex-ai/mcp-http client handles that merge via auth.kind=body.
//
// Endpoints used here are the read-only v3 calls documented at
// https://porkbun.com/api/json/v3/documentation. The `ping` tool exists
// precisely to validate credentials/network at runtime — call it first if
// anything looks off.

import { createClient, HttpError, type Client } from '@zeroindex-ai/mcp-http';

const BASE = 'https://api.porkbun.com/api/json/v3';

export class PorkbunError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: string,
    message: string
  ) {
    super(`Porkbun ${path} status=${status}: ${message}`);
    this.name = 'PorkbunError';
  }
}

function getCreds(): { apikey: string; secretapikey: string } {
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_API_KEY;
  if (!apikey || !secretapikey) {
    throw new Error('PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY environment variables are required');
  }
  return { apikey, secretapikey };
}

// Built fresh per request — see createClient in @zeroindex-ai/mcp-http for why.
function client(): Client {
  const { apikey, secretapikey } = getCreds();
  return createClient({
    vendor: 'Porkbun',
    baseUrl: BASE,
    auth: { kind: 'body', fields: { apikey, secretapikey } },
  });
}

// Internal helper: POST to /<path>, optionally with extra body fields, and
// assert the vendor-level `status === 'SUCCESS'` envelope.
export async function pb<T extends { status: string }>(
  path: string,
  extraBody: Record<string, unknown> = {}
): Promise<T> {
  const c = client();
  const data = await c<T & { message?: string }>({
    method: 'POST',
    path,
    body: extraBody,
  });
  if (data.status !== 'SUCCESS') {
    throw new PorkbunError(path, data.status, data.message ?? 'unknown error');
  }
  return data;
}

export { HttpError };

export type PingResponse = { status: string; yourIp: string };

export type DomainSummary = {
  domain: string;
  status: string;
  tld: string;
  createDate: string;
  expireDate: string;
  securityLock: string;
  whoisPrivacy: string;
  autoRenew: number;
  notLocal: number;
  labels?: { id: string; title: string; color: string }[];
};

export type ListAllResponse = { status: string; domains: DomainSummary[] };

export type DnsRecord = {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: string;
  prio: string | null;
  notes: string;
};

export type RetrieveResponse = { status: string; records: DnsRecord[] };
