import { useSyncExternalStore } from 'react';
import { aiKeysApi, type AccountKeys } from '../api/aiKeys';

/** Providers the server can call with a user's own key (see server/src/ai/llm.ts). */
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

/** "sk-…a1b2" so the user can tell which key is saved without showing it. */
export const maskKey = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

/** What the UI knows about a saved key. Only browser-stored (guest) keys keep the key itself. */
export interface KeyInfo {
  hint: string;
  model?: string;
  verifiedAt?: string;
}

export interface AiKeysState {
  /**
   * Signed in: keys are saved to the account, encrypted on the server, and follow the user to any
   * device. Signed out (or if the server can't encrypt keys): they stay in this browser.
   */
  storage: 'account' | 'browser';
  loading: boolean;
  keys: Partial<Record<AiProvider, KeyInfo>>;
  active: AiProvider | null;
}

/** The key the next generation uses. */
export interface ActiveKey extends KeyInfo {
  provider: AiProvider;
}

// ---------- Browser storage (guests) ----------

interface BrowserKey {
  apiKey: string;
  model?: string;
  addedAt: string;
  verifiedAt?: string;
}

interface BrowserKeys {
  keys: Partial<Record<AiProvider, BrowserKey>>;
  active: AiProvider | null;
}

const STORAGE_KEY = 'flowcraft-ai-keys';
const LEGACY_KEY = 'flowcraft-ai-key';

function readBrowser(): BrowserKeys {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as BrowserKeys | null;
    if (saved?.keys) {
      const keys = Object.fromEntries(PROVIDER_ORDER.filter((p) => saved.keys[p]?.apiKey).map((p) => [p, saved.keys[p]]));
      return { keys, active: saved.active && keys[saved.active] ? saved.active : null };
    }
    // The first version kept a single key.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as { provider: AiProvider; apiKey: string; model?: string } | null;
    if (legacy?.apiKey && legacy.provider in PROVIDERS) {
      localStorage.removeItem(LEGACY_KEY);
      return { keys: { [legacy.provider]: { apiKey: legacy.apiKey, model: legacy.model, addedAt: new Date().toISOString() } }, active: legacy.provider };
    }
  } catch {
    /* storage disabled or corrupt */
  }
  return { keys: {}, active: null };
}

function writeBrowser(next: BrowserKeys) {
  try {
    if (Object.keys(next.keys).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled: keys still work for this visit */
  }
}

let browser = readBrowser();

// ---------- The store ----------

const fromBrowser = (b: BrowserKeys): AiKeysState => ({
  storage: 'browser',
  loading: false,
  active: b.active,
  keys: Object.fromEntries(
    PROVIDER_ORDER.filter((p) => b.keys[p]).map((p) => {
      const k = b.keys[p]!;
      return [p, { hint: maskKey(k.apiKey), model: k.model, verifiedAt: k.verifiedAt }];
    })
  ),
});

const fromAccount = (a: AccountKeys): AiKeysState => ({
  storage: 'account',
  loading: false,
  active: a.active,
  keys: Object.fromEntries(
    a.keys.map((k) => [k.provider, { hint: k.hint, model: k.model ?? undefined, verifiedAt: k.verifiedAt ?? undefined }])
  ),
});

let state: AiKeysState = fromBrowser(browser);
let identity: string | null | undefined;
const listeners = new Set<() => void>();

function set(next: AiKeysState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function setBrowser(next: BrowserKeys) {
  browser = next;
  writeBrowser(next);
  if (state.storage === 'browser') set(fromBrowser(next));
}

/**
 * Called when the signed-in user changes (null when signed out). Signed in, keys come from the
 * account; keys a guest saved in this browser are moved into the account and removed from the browser.
 * `accountKeys` is false when the server can't encrypt keys, so they stay in the browser.
 */
export async function syncKeysWithAccount(userId: string | null, accountKeys: boolean): Promise<{ moved: AiProvider[] }> {
  const id = userId && accountKeys ? userId : null;
  if (id === identity) return { moved: [] };
  identity = id;

  if (!id) {
    set(fromBrowser(browser));
    return { moved: [] };
  }

  set({ storage: 'account', loading: true, keys: {}, active: null });
  const moved: AiProvider[] = [];
  try {
    for (const provider of PROVIDER_ORDER) {
      const key = browser.keys[provider];
      if (!key) continue;
      await aiKeysApi.save(provider, { apiKey: key.apiKey, model: key.model ?? null });
      moved.push(provider);
    }
    if (moved.length) {
      if (browser.active) await aiKeysApi.setActive(browser.active);
      setBrowser({ keys: {}, active: null });
    }
    const account = await aiKeysApi.list();
    if (identity === id) set(fromAccount(account));
  } catch {
    // Keep showing something useful; the page offers a retry by reloading.
    if (identity === id) set({ storage: 'account', loading: false, keys: {}, active: null });
  }
  return { moved };
}

export const getAiKeys = () => state;

/** A key to send with a request: only browser-stored keys. Account keys stay on the server. */
export function getRequestKey(): { provider: AiProvider; apiKey: string; model?: string } | null {
  if (state.storage !== 'browser' || !browser.active) return null;
  const key = browser.keys[browser.active];
  return key ? { provider: browser.active, apiKey: key.apiKey, model: key.model } : null;
}

// ---------- Actions: the same calls whichever storage is in use ----------

/** Saves (or replaces) a key. With `test`, it is only saved if a tiny request with it works. */
export async function saveKey(provider: AiProvider, input: { apiKey?: string; model?: string; test: boolean }) {
  if (state.storage === 'account') {
    set(fromAccount(await aiKeysApi.save(provider, { apiKey: input.apiKey, model: input.model ?? null, test: input.test })));
    return;
  }
  const previous = browser.keys[provider];
  const apiKey = input.apiKey ?? previous?.apiKey;
  if (!apiKey) throw new Error('Enter the API key');
  if (input.test) await aiKeysApi.testBrowserKey({ provider, apiKey, model: input.model });
  setBrowser({
    keys: {
      ...browser.keys,
      [provider]: {
        apiKey,
        ...(input.model && { model: input.model }),
        addedAt: previous?.addedAt ?? new Date().toISOString(),
        ...(input.test && { verifiedAt: new Date().toISOString() }),
      },
    },
    // The first key saved becomes the one used for generating.
    active: browser.active ?? provider,
  });
}

/** Checks a saved key still works, and marks it as tested. */
export async function testKey(provider: AiProvider) {
  if (state.storage === 'account') {
    const result = await aiKeysApi.test(provider);
    set(fromAccount(await aiKeysApi.list()));
    return result;
  }
  const key = browser.keys[provider];
  if (!key) throw new Error('No key saved');
  const result = await aiKeysApi.testBrowserKey({ provider, apiKey: key.apiKey, model: key.model });
  setBrowser({ ...browser, keys: { ...browser.keys, [provider]: { ...key, verifiedAt: new Date().toISOString() } } });
  return result;
}

export async function removeKey(provider: AiProvider) {
  if (state.storage === 'account') {
    await aiKeysApi.remove(provider);
    set(fromAccount(await aiKeysApi.list()));
    return;
  }
  const { [provider]: _removed, ...keys } = browser.keys;
  setBrowser({ keys, active: browser.active === provider ? null : browser.active });
}

/** Chooses which saved key generates diagrams; null switches back to the free generations. */
export async function setActiveKey(provider: AiProvider | null) {
  if (state.storage === 'account') {
    set(fromAccount(await aiKeysApi.setActive(provider)));
    return;
  }
  if (provider && !browser.keys[provider]) return;
  setBrowser({ ...browser, active: provider });
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
  const info = active && keys[active];
  return info ? { provider: active, ...info } : null;
}
