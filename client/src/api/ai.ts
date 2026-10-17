import { useSyncExternalStore } from 'react';
import { getAiKey } from '../lib/aiKey';
import type { DiagramType } from '../lib/diagram/types';
import { api, ApiError } from './client';
import type { GeneratedDiagram } from './types';

export interface FreeUsage {
  limit: number;
  remaining: number;
  resetsAt: string | null;
}

export interface AiStatus {
  /** Whether the server has its own AI key. */
  enabled: boolean;
  /** Free generations left on the server's key, or null when it has none. */
  free: FreeUsage | null;
}

let status: AiStatus | undefined;
let statusPromise: Promise<AiStatus> | null = null;
/** Clerk user id or 'guest': free generations are counted per account, so a sign-in changes the count. */
let identity: string | null = null;
const listeners = new Set<() => void>();

function setStatus(next: AiStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

/** The visitor's own key, sent as headers so it stays out of request bodies and URLs. */
function keyHeaders(): Record<string, string> {
  const key = getAiKey();
  if (!key) return {};
  return { 'X-AI-Provider': key.provider, 'X-AI-Key': key.apiKey, ...(key.model && { 'X-AI-Model': key.model }) };
}

export const aiApi = {
  /** Loads the server's AI status once per session; retried after a failure. Pass refresh to fetch again. */
  status(refresh = false): Promise<AiStatus> {
    if (refresh) statusPromise = null;
    statusPromise ??= api
      .get<AiStatus>('/ai/status')
      .then((next) => {
        setStatus(next);
        return next;
      })
      .catch(() => {
        statusPromise = null;
        const fallback = { enabled: false, free: null };
        setStatus(fallback);
        return fallback;
      });
    return statusPromise;
  },

  /** Refetches the status when the visitor signs in or out. */
  identify(next: string) {
    if (next === identity) return;
    // The first status request may have gone out before the session token was ready.
    const refresh = identity !== null || next !== 'guest';
    identity = next;
    if (refresh) void aiApi.status(true);
  },

  async generate(prompt: string, current?: { type: DiagramType; source: string }) {
    try {
      const res = await api.post<{ diagram: GeneratedDiagram; free?: FreeUsage }>('/ai/generate', { prompt, current }, { headers: keyHeaders() });
      if (res.free && status) setStatus({ ...status, free: res.free });
      return res.diagram;
    } catch (err) {
      // The free count may have changed (used up, or someone else on this IP), so show the real number.
      void aiApi.status(true);
      throw err;
    }
  },
};

/** Errors that a (different) own key would fix, so the UI offers the key dialog next to them. */
export const needsOwnKey = (err: unknown) =>
  err instanceof ApiError && ['AI_FREE_LIMIT', 'AI_KEY_REQUIRED', 'AI_KEY_INVALID'].includes(err.code ?? '');

function subscribe(listener: () => void) {
  listeners.add(listener);
  void aiApi.status();
  return () => listeners.delete(listener);
}

/** The server's AI status, or undefined while it loads. */
export function useServerAiStatus() {
  return useSyncExternalStore(subscribe, () => status);
}
