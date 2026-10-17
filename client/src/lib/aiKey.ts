import { useSyncExternalStore } from 'react';

/** Providers the server can call with a visitor's own key (see server/src/ai/llm.ts). */
export type AiProvider = 'gemini' | 'openai' | 'gateway';

export interface AiKey {
  provider: AiProvider;
  apiKey: string;
  /** Empty means the provider's default model. */
  model?: string;
}

export const PROVIDERS: Record<AiProvider, { label: string; keyUrl: string; keyHint: string; defaultModel: string; note: string }> = {
  gemini: {
    label: 'Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    defaultModel: 'gemini-2.5-flash',
    note: 'Google AI Studio keys are free to create and include a free tier.',
  },
  openai: {
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    defaultModel: 'gpt-4.1-mini',
    note: 'Billed to your OpenAI account.',
  },
  gateway: {
    label: 'Vercel AI Gateway',
    keyUrl: 'https://vercel.com/ai-gateway',
    keyHint: 'vck_…',
    defaultModel: 'google/gemini-2.5-flash',
    note: 'One key for many models, written as provider/model.',
  },
};

// The key lives only in this browser. It is sent with each AI request and never stored by the server.
const STORAGE_KEY = 'flowcraft-ai-key';
const listeners = new Set<() => void>();

function read(): AiKey | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AiKey | null;
    return saved && saved.provider in PROVIDERS && typeof saved.apiKey === 'string' && saved.apiKey ? saved : null;
  } catch {
    return null;
  }
}

let current = read();

export const getAiKey = () => current;

export function setAiKey(next: AiKey | null) {
  current = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled: the key still works for this visit */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAiKey() {
  return useSyncExternalStore(subscribe, getAiKey);
}

/** "sk-…a1b2" so the user can tell which key is saved without showing it. */
export const maskKey = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;
