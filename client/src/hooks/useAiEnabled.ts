import { useEffect } from 'react';
import { aiApi, useServerAiStatus } from '../api/ai';
import { useAuth } from '../context/AuthContext';
import { useAiKey } from '../lib/aiKey';

/**
 * Whether AI generation can run right now: with the visitor's own key, or with free generations
 * left on the server's key. `reason` says why not, so the UI can ask for a key.
 */
export function useAiStatus() {
  const ownKey = useAiKey();
  const server = useServerAiStatus();
  const free = server?.free ?? null;
  const { user, ready } = useAuth();
  const identity = ready ? (user?.id ?? 'guest') : null;

  useEffect(() => {
    if (identity) aiApi.identify(identity);
  }, [identity]);

  const base = { ownKey, free, freeTier: server?.freeTier ?? null };
  if (ownKey) return { ...base, loading: false, usable: true, reason: null } as const;
  if (!server) return { ...base, loading: true, usable: undefined, reason: null } as const;
  if (!server.enabled) return { ...base, loading: false, usable: false, reason: 'no-server-key' } as const;
  if (!free || free.remaining <= 0) return { ...base, loading: false, usable: false, reason: 'free-used' } as const;
  return { ...base, loading: false, usable: true, reason: null } as const;
}

/** undefined while loading, then true/false. */
export function useAiEnabled() {
  return useAiStatus().usable;
}
