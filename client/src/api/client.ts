import { getToken } from '@clerk/react';

const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

/** The current Clerk session token, or null for guests (or if Clerk couldn't load). */
async function sessionToken(): Promise<string | null> {
  try {
    return await getToken();
  } catch {
    return null;
  }
}

interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: ErrorDetail[] = [],
    /** Machine-readable reason from the server, e.g. 'AI_FREE_LIMIT'. */
    public readonly code?: string
  ) {
    super(message);
  }

  /** { email: 'Enter a valid email address', ... } for showing errors next to inputs. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

type Query = Record<string, string | undefined>;

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function request<T>(path: string, { method = 'GET', body, query, signal, headers: extraHeaders }: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { ...extraHeaders };
  const token = await sessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Is the API running?');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? `Request failed (${res.status})`, data.error?.details, data.error?.code);
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, opts),
  post: <T>(path: string, body?: unknown, opts?: Pick<RequestOptions, 'headers' | 'signal'>) =>
    request<T>(path, { ...opts, method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};
