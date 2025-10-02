"use client";
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps { variant?: 'pill' | 'square'; }
export default function ThemeToggle({ variant='pill' }: ThemeToggleProps){
  const { theme, toggle } = useTheme();
  const isLight = theme === 'light';
  if (variant === 'square') {
    return (
      <button
        aria-label="Toggle theme"
        onClick={toggle}
        data-mode={isLight? 'light':'dark'}
        className="theme-toggle-square"
        type="button"
      >
        <span className="icon sun">☼</span>
        <span className="icon moon">☾</span>
      </button>
    );
  }
  return (
    <button
      aria-label="Toggle theme"
      onClick={toggle}
      data-mode={isLight? 'light':'dark'}
      className="theme-toggle-pill"
      type="button"
    >
      <span className="theme-toggle-icon moon">☾</span>
      <span className="theme-toggle-icon sun">☼</span>
      <span className="theme-toggle-thumb" />
    </button>
  );
}
