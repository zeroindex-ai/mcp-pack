// Thin Porkbun JSON v3 client.
//
// Auth: every request is a POST with apikey + secretapikey merged into the
// JSON body (Porkbun's design — credentials go in the body, not headers).
// Endpoints used here are the read-only v3 calls documented at
// https://porkbun.com/api/json/v3/documentation. The `ping` tool exists
// precisely to validate credentials/network at runtime — call it first if
// anything looks off.

const BASE = 'https://api.porkbun.com/api/json/v3';

function getCreds(): { apikey: string; secretapikey: string } {
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_API_KEY;
  if (!apikey || !secretapikey) {
    throw new Error(
      'PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY environment variables are required'
    );
  }
  return { apikey, secretapikey };
}

export async function pb<T extends { status: string }>(
  path: string,
  extraBody: Record<string, unknown> = {}
): Promise<T> {
  const url = `${BASE}${path}`;
  const body = JSON.stringify({ ...getCreds(), ...extraBody });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Porkbun ${path} HTTP ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as T & { message?: string };
  if (data.status !== 'SUCCESS') {
    throw new Error(`Porkbun ${path} status=${data.status}: ${data.message ?? 'unknown error'}`);
  }
  return data;
}

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
