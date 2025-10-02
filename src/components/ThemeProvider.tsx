"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';
interface ThemeCtx { theme: Theme; toggle: () => void; set: (t: Theme)=>void; }
const ThemeContext = createContext<ThemeCtx | null>(null);

function getPreferred(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('miko-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  return media.matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => { setTheme(getPreferred()); }, []);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      window.localStorage.setItem('miko-theme', theme);
    }
  }, [theme]);
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return <ThemeContext.Provider value={{ theme, toggle, set: setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
