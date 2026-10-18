import { useEffect } from 'react';
import { aiApi, useServerAiStatus } from '../api/ai';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PROVIDERS, syncKeysWithAccount, useAiKey } from '../lib/aiKey';

/**
 * Keeps AI state in step with sign-in: the free-generation count (accounts and guests are counted
 * separately) and where API keys live. Mounted once, in the app layout.
 */
export function useAiAccountSync() {
  const { user, ready } = useAuth();
  const toast = useToast();
  const server = useServerAiStatus();
  const identity = ready ? (user?.id ?? 'guest') : null;
  const accountKeys = server?.accountKeys;

  useEffect(() => {
    if (identity) aiApi.identify(identity);
  }, [identity]);

  useEffect(() => {
    if (!identity || accountKeys === undefined) return;
    void syncKeysWithAccount(identity === 'guest' ? null : identity, accountKeys).then(({ moved }) => {
      if (moved.length) toast(`Your ${moved.map((p) => PROVIDERS[p].label).join(' and ')} key was saved to your account`, 'success');
    });
  }, [identity, accountKeys, toast]);
}

/**
 * Whether AI generation can run right now: with the user's own key, or with free generations
 * left on the server's key. `reason` says why not, so the UI can ask for a key or a sign-in.
 */
export function useAiStatus() {
  const ownKey = useAiKey();
  const server = useServerAiStatus();
  const free = server?.free ?? null;

  const base = { ownKey, free, freeTier: server?.freeTier ?? null, limits: server?.limits ?? null, signedIn: server?.signedIn ?? false };
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
