// Tri-state theme: 'system' follows OS, 'light' / 'dark' are explicit.
// Stored in localStorage under `theme`; applied via `data-theme` on <html>.

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export const NEXT_THEME: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};
