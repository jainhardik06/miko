"use client";
import { useEffect, useState, useCallback } from 'react';
import { fetchTrees, Tree, ratePpmToTokens } from '../lib/aptos';
import { useMikoStore } from '../state/store';

export function TreeList() {
  const account = useMikoStore(s => s.account);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const list = await fetchTrees(50);
      setTrees(list.filter(t => t.owner === account));
    } finally { setLoading(false); }
  }, [account]);

  useEffect(() => {
    load();
    if (!account) return;
    const interval = setInterval(() => { load(); }, 8000);
    return () => clearInterval(interval);
  }, [account, load]);

  if (!account) return <p className="text-xs text-neutral-500">Connect wallet to view your Trees.</p>;
  if (loading && trees.length === 0) return <p className="text-xs text-neutral-400">Loading trees…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {trees.map(t => (
        <div key={t.id} className="rounded-lg border border-neutral-800/50 p-4 bg-neutral-900/40">
          <h2 className="font-medium">Tree #{t.id}</h2>
          <p className="text-xs text-neutral-500 mt-1">Granted: {(t.granted_cct ?? ratePpmToTokens(t.rate_ppm)).toFixed(2)} CCT</p>
          <p className="text-xs text-neutral-500">Minted to wallet on {new Date(t.created_at * 1000).toLocaleDateString()}</p>
        </div>
      ))}
      {trees.length === 0 && !loading && <p className="text-xs text-neutral-600">No trees yet.</p>}
    </div>
  );
}
