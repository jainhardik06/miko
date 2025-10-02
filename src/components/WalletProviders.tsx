"use client";
import React from 'react';
import { AptosWalletAdapterProvider, Wallet } from '@aptos-labs/wallet-adapter-react';
// NOTE: To add specific wallet adapters (e.g. Petra, Martian) install their packages (e.g. @aptos-labs/wallet-adapter-petra)
// and create plugin instances: const plugins = [new PetraWallet(), new MartianWallet()];
// For now we leave the list empty so only injected wallets that the provider can detect will appear.

interface Props {
  children: React.ReactNode;
}

export function WalletProviders({ children }: Props) {
  // Network selection could be made dynamic (env or Zustand). Keeping DEVNET for PoC.
  const plugins: Wallet[] = [];

  return (
    <AptosWalletAdapterProvider
      plugins={plugins}
      autoConnect
      onError={(e: unknown) => console.error('Wallet error', e)}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
