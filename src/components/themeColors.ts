// Centralized theme-aware accent colors for 3D scenes.
// We keep raw hex seeds here to avoid scattering magic numbers.

export const ACCENT_BASE = '#19ffc0'; // primary emerald / aqua accent used in dark mode
export const ACCENT_AMBER = '#ffb347'; // secondary highlight (amber)

// Emissive intensity presets (can be tuned globally)
export const EMISSIVE_INTENSITY = {
  // Light mode values intentionally restrained for "studio" look (less glow, more form)
  hero: { dark: 1.3, light: 0.5 },
  spot: { dark: 2.8, light: 1.4 },
  generic: { dark: 0.9, light: 0.42 },
};

export const BLOOM_INTENSITY = {
  hero: { dark: 1.05, light: 0.55 },
  mini: { dark: 0.7, light: 0.48 },
};

// Helper to pick value by resolved theme string ('light' | 'dark').
export function pick<T extends { light: any; dark: any }>(map: T, resolved: string){
  return resolved === 'light' ? map.light : map.dark;
}
