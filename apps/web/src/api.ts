import type { ApiError, ApiResult } from '@checkout/contracts';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiFailure extends Error {
  readonly code: string;
  readonly fields: ApiError['error']['fields'];

  constructor(
    public readonly status: number,
    body: ApiError | undefined,
  ) {
    super(body?.error.message ?? 'Не удалось связаться с сервером.');
    this.code = body?.error.code ?? 'NETWORK_ERROR';
    this.fields = body?.error.fields;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  idempotencyKey?: string;
};

export async function request<T>(path: string, token: string | null, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiFailure(0, undefined);
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => undefined)) as
    ApiResult<T> | ApiError | undefined;
  if (!response.ok)
    throw new ApiFailure(response.status, body && 'error' in body ? body : undefined);
  if (!body || !('data' in body)) throw new ApiFailure(response.status, undefined);
  return body.data;
}

export const newKey = () => crypto.randomUUID();
