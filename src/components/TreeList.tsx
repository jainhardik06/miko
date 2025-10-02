"use client";
import { useEffect, useState, useCallback } from 'react';
import { fetchTrees, pendingAmount, buildClaimCCTTx, Tree, TxResult } from '../lib/aptos';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useMikoStore } from '../state/store';

export function TreeList() {
  const account = useMikoStore(s => s.account);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const { signAndSubmitTransaction } = useWallet();

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const list = await fetchTrees(50);
      const enriched = await Promise.all(list.map(async t => ({
        ...t,
        pending: await pendingAmount(t.id)
      })));
      setTrees(enriched.filter(t => t.owner === account));
    } finally { setLoading(false); }
  }, [account]);

  useEffect(() => {
    load();
    if (!account) return;
    const interval = setInterval(() => { load(); }, 8000);
    return () => clearInterval(interval);
  }, [account, load]);

  async function onClaim(id: number) {
    if (!account) return;
    setClaimingId(id);
    try {
      setTrees(cur => cur.map(t => t.id === id ? { ...t, cumulative_claimed: t.cumulative_claimed + (t.pending || 0), pending: 0 } : t));
  const tx = buildClaimCCTTx(account, id);
  await (signAndSubmitTransaction as unknown as (t: unknown)=>Promise<TxResult>)(tx);
      const p = await pendingAmount(id);
      setTrees(cur => cur.map(t => t.id === id ? { ...t, pending: p } : t));
    } finally { setClaimingId(null); }
  }

  if (!account) return <p className="text-xs text-neutral-500">Connect wallet to view your Trees.</p>;
  if (loading && trees.length === 0) return <p className="text-xs text-neutral-400">Loading trees…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {trees.map(t => (
        <div key={t.id} className="rounded-lg border border-neutral-800/50 p-4 bg-neutral-900/40">
          <h2 className="font-medium">Tree #{t.id}</h2>
          <p className="text-xs text-neutral-500 mt-1">Rate: {t.rate_ppm} ppm</p>
          <p className="text-xs text-neutral-500">Pending: {t.pending}</p>
          <button disabled={claimingId===t.id || !t.pending} onClick={() => onClaim(t.id)} className="mt-3 text-xs rounded bg-emerald-600/80 disabled:opacity-40 hover:bg-emerald-500 px-3 py-1 font-medium">{claimingId===t.id ? 'Claiming…':'Claim'}</button>
        </div>
      ))}
      {trees.length === 0 && !loading && <p className="text-xs text-neutral-600">No trees yet.</p>}
    </div>
  );
}
