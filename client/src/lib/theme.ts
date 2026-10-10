import { useSyncExternalStore } from 'react';

/** "system" follows the operating system's light/dark setting, like macOS's Auto appearance. */
export type ThemePreference = 'light' | 'dark' | 'system';

// index.html reads the same key before first paint, so the page never flashes the wrong theme.
const STORAGE_KEY = 'flowcraft-theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

let preference = readPreference();

/** Styles switch on `<html data-theme="light|dark">` (see styles/tokens.css). */
function apply() {
  const dark = preference === 'dark' || (preference === 'system' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

systemDark.addEventListener('change', () => {
  if (preference === 'system') apply();
});
apply();

function setPreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage disabled: the choice still applies for this visit */
  }
  apply();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference() {
  const current = useSyncExternalStore(subscribe, () => preference);
  return [current, setPreference] as const;
}
