"use client";
import { useTheme } from './ThemeProvider';
import * as React from 'react';

/** Theme-aware background color for R3F scenes.
 * Falls back gracefully if theme not ready. */
export function SceneBackground({ lightOverride, darkOverride }: { lightOverride?: string; darkOverride?: string }){
  const { resolved } = useTheme();
  const light = lightOverride || '#E5E5E5'; // studio backdrop
  const dark = darkOverride || '#000000';
  const color = resolved === 'light' ? light : dark;
  return <color attach="background" args={[color]} />;
}

export default SceneBackground;
