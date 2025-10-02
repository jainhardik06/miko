"use client";
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps { variant?: 'pill' | 'square'; }
export default function ThemeToggle({ variant='pill' }: ThemeToggleProps){
  const { theme, resolved, toggle } = useTheme();
  const isLight = resolved === 'light';
  const modeLabel = theme === 'auto' ? `auto (${resolved})` : theme;
  if (variant === 'square') {
    return (
      <button
        aria-label={`Toggle theme (current ${modeLabel})`}
        title={`Theme: ${modeLabel} (click to cycle)`}
        onClick={toggle}
        data-mode={isLight? 'light':'dark'}
        data-theme-state={theme}
        className="theme-toggle-square"
        type="button"
      >
        <span className="icon sun">☼</span>
        <span className="icon moon">☾</span>
        <span className="icon auto" aria-hidden="true">A</span>
      </button>
    );
  }
  return (
    <button
      aria-label={`Toggle theme (current ${modeLabel})`}
      title={`Theme: ${modeLabel} (click to cycle)`}
      onClick={toggle}
      data-mode={isLight? 'light':'dark'}
      data-theme-state={theme}
      className="theme-toggle-pill"
      type="button"
    >
      <span className="theme-toggle-icon moon">☾</span>
      <span className="theme-toggle-icon sun">☼</span>
      <span className="theme-toggle-icon auto">A</span>
      <span className="theme-toggle-thumb" />
    </button>
  );
}
