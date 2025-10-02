"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'auto';
interface ThemeCtx { theme: Theme; resolved: 'dark' | 'light'; toggle: () => void; set: (t: Theme)=>void; }
const ThemeContext = createContext<ThemeCtx | null>(null);

function getPreferred(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem('miko-theme');
  if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored as Theme;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  return media.matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark');
  useEffect(() => { setTheme(getPreferred()); }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function sync(){
      const newResolved: 'dark' | 'light' = theme === 'auto' ? (media.matches ? 'dark':'light') : theme;
      setResolved(newResolved);
      const root = document.documentElement;
      root.classList.add('theme-transition');
      requestAnimationFrame(()=>{
        if (newResolved === 'dark') {
          root.classList.add('dark'); root.classList.remove('light');
        } else { root.classList.add('light'); root.classList.remove('dark'); }
        root.classList.remove('theme-transition');
      });
      window.localStorage.setItem('miko-theme', theme);
    }
    sync();
    if(theme==='auto'){
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }
  }, [theme]);
  const cycle: Theme[] = ['dark','light','auto'];
  const toggle = () => setTheme(t => cycle[(cycle.indexOf(t)+1)%cycle.length]);
  return <ThemeContext.Provider value={{ theme, resolved, toggle, set: setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
