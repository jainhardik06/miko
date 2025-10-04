"use client";
import { useState } from 'react';
import { connectPetra } from '../lib/petra';
import { useMikoStore } from '../state/store';

export function ConnectWalletButton(){
  const [acc, setAcc] = useState<{address:string; publicKey?:string}|null>(null);
  const [loading, setLoading] = useState(false);
  const setAccount = useMikoStore(s=>s.setAccount);

  async function onConnect(){
    try {
      setLoading(true);
      const a = await connectPetra();
      setAcc(a); setAccount(a.address);
    } catch(e:any){
      // eslint-disable-next-line no-alert
      alert(e.message || 'Failed to connect Petra');
    } finally { setLoading(false); }
  }

  function onDisconnect(){ setAcc(null); setAccount(undefined); }

  if(!acc){
    return (
      <button onClick={onConnect} disabled={loading} className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium shadow">
        {loading? 'Connecting…':'Connect Petra'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono bg-neutral-800 px-2 py-1 rounded text-neutral-300">{acc.address.slice(0,6)}…{acc.address.slice(-4)}</span>
      <button onClick={onDisconnect} className="px-2 py-1 rounded-md bg-neutral-700 hover:bg-neutral-600 text-xs text-neutral-200">Disconnect</button>
    </div>
  );
}
