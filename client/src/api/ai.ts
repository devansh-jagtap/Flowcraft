import { useSyncExternalStore } from 'react';
import { getRequestKey, type AiProvider } from '../lib/aiKey';
import { keyHeaders } from './aiKeys';
import type { DiagramType } from '../lib/diagram/types';
import { api, ApiError } from './client';
import type { GeneratedDiagram } from './types';

export interface FreeUsage {
  limit: number;
  remaining: number;
  resetsAt: string | null;
}

/** The provider and model the free generations run on. */
export interface FreeTier {
  provider: AiProvider;
  label: string;
  model: string;
}

export interface AiStatus {
  /** Whether the server has its own AI key. */
  enabled: boolean;
  /** Free generations left on the server's key, or null when it has none. */
  free: FreeUsage | null;
  freeTier: FreeTier | null;
  /** Free generations per window for guests (per network address) and for accounts. */
  limits: { guest: number; account: number; windowHours: number };
  signedIn: boolean;
  /** Whether the server can save API keys to accounts (it needs AI_KEYS_SECRET). */
  accountKeys: boolean;
}

export interface UsageRow {
  source: 'free' | 'own';
  provider: AiProvider;
  model: string;
  generations: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  lastUsedAt: string;
}

export interface UsageEvent {
  id: number;
  source: 'free' | 'own';
  provider: AiProvider;
  model: string;
  ok: boolean;
  errorCode: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  prompt: string | null;
  createdAt: string;
}

export interface AiUsage {
  free: FreeUsage | null;
  freeTier: FreeTier | null;
  windowDays: number;
  byModel: UsageRow[];
  daily: { day: string; generations: number; tokens: number }[];
  recent: UsageEvent[];
}

let status: AiStatus | undefined;
let statusPromise: Promise<AiStatus> | null = null;
/** Clerk user id or 'guest': free generations are counted per account, so a sign-in changes the count. */
let identity: string | null = null;
/** Bumped after every generation so the usage dashboard knows to reload. */
let usageVersion = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setStatus(next: AiStatus) {
  status = next;
  notify();
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
        const fallback: AiStatus = {
          enabled: false,
          free: null,
          freeTier: null,
          limits: { guest: 0, account: 0, windowHours: 24 },
          signedIn: false,
          accountKeys: false,
        };
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
      const res = await api.post<{ diagram: GeneratedDiagram; free?: FreeUsage }>('/ai/generate', { prompt, current }, { headers: keyHeaders(getRequestKey()) });
      if (res.free && status) setStatus({ ...status, free: res.free });
      return res.diagram;
    } catch (err) {
      // The free count may have changed (used up, or someone else on this IP), so show the real number.
      void aiApi.status(true);
      throw err;
    } finally {
      usageVersion += 1;
      notify();
    }
  },

  usage: (signal?: AbortSignal) => api.get<AiUsage>('/ai/usage', { signal }),
};

/** Errors that a (different) own key would fix, so the UI offers the key settings next to them. */
export const needsOwnKey = (err: unknown) =>
  err instanceof ApiError && ['AI_FREE_LIMIT', 'AI_KEY_REQUIRED', 'AI_KEY_INVALID', 'AI_SIGN_IN'].includes(err.code ?? '');

function subscribe(listener: () => void) {
  listeners.add(listener);
  void aiApi.status();
  return () => listeners.delete(listener);
}

/** The server's AI status, or undefined while it loads. */
export function useServerAiStatus() {
  return useSyncExternalStore(subscribe, () => status);
}

/** Changes after each generation; the usage dashboard reloads when it does. */
export function useUsageVersion() {
  return useSyncExternalStore(subscribe, () => usageVersion);
}
