import type { AiProvider } from '../lib/aiKey';
import { api } from './client';

/** A key saved to the account. The server never sends the key itself, only a masked hint. */
export interface AccountKey {
  provider: AiProvider;
  hint: string;
  model: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface AccountKeys {
  keys: AccountKey[];
  /** The key that generates diagrams, or null for the free generations. */
  active: AiProvider | null;
}

export interface KeyTestResult {
  ok: true;
  provider: AiProvider;
  model: string;
  latencyMs: number;
}

/** A key sent as headers, so it stays out of request bodies and URLs. */
export function keyHeaders(key: { provider: AiProvider; apiKey: string; model?: string } | null): Record<string, string> {
  if (!key) return {};
  return { 'X-AI-Provider': key.provider, 'X-AI-Key': key.apiKey, ...(key.model && { 'X-AI-Model': key.model }) };
}

export const aiKeysApi = {
  list: () => api.get<AccountKeys>('/ai/keys'),
  /** With `test`, the server only saves the key if a tiny request with it works. */
  save: (provider: AiProvider, body: { apiKey?: string; model?: string | null; test?: boolean }) =>
    api.put<AccountKeys>(`/ai/keys/${provider}`, body),
  test: (provider: AiProvider) => api.post<KeyTestResult>(`/ai/keys/${provider}/test`),
  remove: (provider: AiProvider) => api.delete(`/ai/keys/${provider}`),
  setActive: (provider: AiProvider | null) => api.put<AccountKeys>('/ai/keys/active', { provider }),
  /** Checks a key that only lives in this browser (guests). */
  testBrowserKey: (key: { provider: AiProvider; apiKey: string; model?: string }) =>
    api.post<KeyTestResult>('/ai/test-key', {}, { headers: keyHeaders(key) }),
};
