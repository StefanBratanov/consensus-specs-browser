import { useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, NEXT_THEME, type Theme } from '../lib/theme';

const LABEL: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const ICON: Record<Theme, string> = {
  system: '🌗',
  light: '☀',
  dark: '☾',
};

export function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function cycle() {
    setTheme((t) => NEXT_THEME[t]);
  }

  return (
    <button
      className="theme-btn"
      onClick={cycle}
      title={`Theme: ${LABEL[theme]} (click to cycle)`}
      aria-label={`Theme: ${LABEL[theme]}`}
    >
      <span className="theme-icon" aria-hidden>
        {ICON[theme]}
      </span>
      <span className="theme-label">{LABEL[theme]}</span>
    </button>
  );
}
