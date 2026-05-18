export type Auth =
  | { kind: 'bearer'; token: string }
  | { kind: 'body'; fields: Record<string, string> }
  | { kind: 'none' };

export type ClientOptions = {
  vendor: string;
  baseUrl: string;
  auth: Auth;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  retryOn429?: boolean;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export class HttpError extends Error {
  constructor(
    public readonly vendor: string,
    public readonly path: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(`${vendor} ${path} HTTP ${status}: ${body}`);
    this.name = 'HttpError';
  }
}

export type Client = <T>(opts: RequestOptions) => Promise<T>;
