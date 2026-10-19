'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const read = (): Theme => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

/** Light / dark switch. The choice is kept in this browser; with no choice it follows the device setting. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => setTheme(read()), []);
  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ws-theme', next); } catch { /* private mode: still switches for this visit */ }
    setTheme(next);
  };
  return (
    <button type="button" className="chip theme-toggle" onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="tt-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
