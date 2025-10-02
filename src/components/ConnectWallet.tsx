"use client";
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useMikoStore } from '../state/store';
import { useEffect } from 'react';

export function ConnectWalletButton() {
  const { account, connect, disconnect, connected, wallets } = useWallet();
  const setAccount = useMikoStore(s => s.setAccount);

  // Sync Zustand account when wallet changes
  useEffect(() => {
    if (connected && account?.address) {
      setAccount(account.address);
    } else if (!connected) {
      setAccount(undefined);
    }
  }, [connected, account, setAccount]);

  if (!connected) {
    const first = wallets && wallets.length > 0 ? wallets[0] : undefined;
    return (
      <div className="flex items-center gap-2">
        {first ? (
          <button
            onClick={() => connect(first.name)}
            className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow"
          >
            Connect {first.name}
          </button>
        ) : (
          <span className="text-xs text-neutral-500">No Aptos wallet detected</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono bg-neutral-800 px-2 py-1 rounded text-neutral-300">
        {account?.address.slice(0, 6)}…{account?.address.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="px-2 py-1 rounded-md bg-neutral-700 hover:bg-neutral-600 text-xs text-neutral-200"
      >
        Disconnect
      </button>
    </div>
  );
}
