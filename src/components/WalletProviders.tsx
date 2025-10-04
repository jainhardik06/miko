"use client";
// Stubbed WalletProviders: adapter system removed. This component now simply renders children.
// Left in place so existing imports (if any remain in future merges) do not break the build.
import React from 'react';

export function WalletProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
