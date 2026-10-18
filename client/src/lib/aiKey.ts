import { useSyncExternalStore } from 'react';

/** Providers the server can call with a visitor's own key (see server/src/ai/llm.ts). */
export type AiProvider = 'gemini' | 'openai' | 'gateway';

export const PROVIDER_ORDER: AiProvider[] = ['gemini', 'openai', 'gateway'];

export const PROVIDERS: Record<
  AiProvider,
  { label: string; keyUrl: string; keyHint: string; defaultModel: string; modelHint: string; note: string }
> = {
  gemini: {
    label: 'Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AQ.… or AIza…',
    defaultModel: 'gemini-2.5-flash',
    modelHint: 'e.g. gemini-2.5-pro',
    note: 'Free to create in Google AI Studio, with a free tier.',
  },
  openai: {
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    defaultModel: 'gpt-4.1-mini',
    modelHint: 'e.g. gpt-4.1, gpt-5-mini',
    note: 'Billed to your OpenAI account.',
  },
  gateway: {
    label: 'Vercel AI Gateway',
    keyUrl: 'https://vercel.com/ai-gateway',
    keyHint: 'vck_…',
    defaultModel: 'google/gemini-2.5-flash',
    modelHint: 'provider/model, e.g. anthropic/claude-sonnet-4',
    note: 'One key for models from many providers.',
  },
};

/** Guesses the provider from a key's prefix, so a key pasted under the wrong provider is caught. */
export function detectProvider(apiKey: string): AiProvider | null {
  const key = apiKey.trim();
  if (/^vck_/.test(key)) return 'gateway';
  if (/^sk-/.test(key)) return 'openai';
  if (/^(AIza|AQ\.)/.test(key)) return 'gemini';
  return null;
}

export interface SavedKey {
  apiKey: string;
  /** Empty means the provider's default model. */
  model?: string;
  addedAt: string;
  /** Set when "Test key" last succeeded. */
  verifiedAt?: string;
}

export interface AiKeys {
  keys: Partial<Record<AiProvider, SavedKey>>;
  /** The key used for generating, or null to use the free generations. */
  active: AiProvider | null;
}

/** The key the next generation will use. */
export interface ActiveKey extends SavedKey {
  provider: AiProvider;
}

// Keys live only in this browser. They are sent with each AI request and never stored by the server.
const STORAGE_KEY = 'flowcraft-ai-keys';
const LEGACY_KEY = 'flowcraft-ai-key';
const EMPTY: AiKeys = { keys: {}, active: null };
const listeners = new Set<() => void>();

function read(): AiKeys {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AiKeys | null;
    if (saved?.keys) {
      const keys = Object.fromEntries(PROVIDER_ORDER.filter((p) => saved.keys[p]?.apiKey).map((p) => [p, saved.keys[p]]));
      return { keys, active: saved.active && keys[saved.active] ? saved.active : null };
    }
    // The first version kept a single key; carry it over.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as { provider: AiProvider; apiKey: string; model?: string } | null;
    if (legacy?.apiKey && legacy.provider in PROVIDERS) {
      const migrated: AiKeys = {
        keys: { [legacy.provider]: { apiKey: legacy.apiKey, model: legacy.model, addedAt: new Date().toISOString() } },
        active: legacy.provider,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
  } catch {
    /* storage disabled or corrupt: start empty */
  }
  return EMPTY;
}

let current = read();

function write(next: AiKeys) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage disabled: keys still work for this visit */
  }
  listeners.forEach((listener) => listener());
}

export const getAiKeys = () => current;

export function getActiveKey(): ActiveKey | null {
  const { active, keys } = current;
  const saved = active && keys[active];
  return saved ? { provider: active, ...saved } : null;
}

/** Saves (or replaces) a provider's key. A newly added key becomes the active one. */
export function saveProviderKey(provider: AiProvider, key: { apiKey: string; model?: string; verifiedAt?: string }) {
  const previous = current.keys[provider];
  const unchanged = previous?.apiKey === key.apiKey && (previous.model ?? '') === (key.model ?? '');
  // A changed key or model has not been tested yet.
  const verifiedAt = key.verifiedAt ?? (unchanged ? previous?.verifiedAt : undefined);
  const saved: SavedKey = {
    apiKey: key.apiKey,
    ...(key.model && { model: key.model }),
    addedAt: previous?.addedAt ?? new Date().toISOString(),
    ...(verifiedAt && { verifiedAt }),
  };
  write({ keys: { ...current.keys, [provider]: saved }, active: previous ? current.active : provider });
}

export function markVerified(provider: AiProvider) {
  const saved = current.keys[provider];
  if (saved) write({ ...current, keys: { ...current.keys, [provider]: { ...saved, verifiedAt: new Date().toISOString() } } });
}

export function removeProviderKey(provider: AiProvider) {
  const { [provider]: _removed, ...keys } = current.keys;
  write({ keys, active: current.active === provider ? null : current.active });
}

/** Chooses which saved key generates diagrams; null switches back to the free generations. */
export function setActiveProvider(provider: AiProvider | null) {
  if (provider && !current.keys[provider]) return;
  write({ ...current, active: provider });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiKeys() {
  return useSyncExternalStore(subscribe, getAiKeys);
}

/** The key used for generating, or null for the free generations. */
export function useAiKey(): ActiveKey | null {
  const { keys, active } = useAiKeys();
  const saved = active && keys[active];
  return saved ? { provider: active, ...saved } : null;
}

/** "sk-…a1b2" so the user can tell which key is saved without showing it. */
export const maskKey = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;
