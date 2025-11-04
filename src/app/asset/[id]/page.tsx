"use client";
import { useEffect, useState } from 'react';
import { getTree, microToTokens, ratePpmToTokens, Tree } from '@/lib/aptos';

interface Props { params: { id: string }; }

export default function AssetDetailPage({ params }: Props) {
  const treeId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Tree | null>(null);
  const [pending, setPending] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getTree(treeId);
        if (!mounted) return;
        setMeta(t);
        if (t) {
          const totalGranted = Number.isFinite(t.granted_cct)
            ? Number(t.granted_cct)
            : ratePpmToTokens(t.rate_ppm);
          const alreadyClaimed = microToTokens(t.cumulative_claimed);
          setPending(Math.max(0, totalGranted - alreadyClaimed));
        } else {
          setPending(0);
        }
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [treeId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 space-y-12">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Asset #{treeId}</h1>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">Detailed on-chain state for TreeNFT plus accrual telemetry. Event history & related listings coming soon.</p>
      </header>
      <section className="grid gap-10 md:grid-cols-3">
        <div className="md:col-span-2 space-y-8">
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-6 backdrop-blur relative">
            <h2 className="text-sm font-medium tracking-wide text-neutral-300">Metadata</h2>
            {loading && <div className="absolute inset-0 bg-neutral-950/40 flex items-center justify-center text-[10px] text-neutral-500">Loading…</div>}
            {meta && (
              <div className="mt-4 grid gap-4 text-xs text-neutral-500 md:grid-cols-2">
                <div><span className="block text-neutral-400">Owner</span><span className="font-mono text-[11px]">{meta.owner.slice(0,10)}…</span></div>
                <div><span className="block text-neutral-400">Rate (ppm)</span><span>{meta.rate_ppm}</span></div>
                <div><span className="block text-neutral-400">Status</span><span>{meta.status}</span></div>
                <div><span className="block text-neutral-400">Cumulative Claimed</span><span>{meta.cumulative_claimed}</span></div>
                <div className="md:col-span-2"><span className="block text-neutral-400">Metadata URI</span><span className="break-all text-[10px]">{meta.metadata_uri || '—'}</span></div>
              </div>
            )}
            {!loading && !meta && <div className="mt-6 text-xs text-neutral-500">Not found.</div>}
          </div>
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-6 backdrop-blur">
            <h2 className="text-sm font-medium tracking-wide text-neutral-300">History</h2>
            <div className="mt-4 h-40 rounded-md border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500">Claim / Rate Events Chart Placeholder</div>
          </div>
        </div>
        <aside className="space-y-8">
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-6 backdrop-blur">
            <h2 className="text-sm font-medium tracking-wide text-neutral-300">Live Accrual</h2>
            <p className="mt-4 text-3xl font-mono">{pending}<span className="text-sm ml-1 font-normal">CCT</span></p>
            <button disabled className="mt-6 w-full px-4 py-2 rounded-md bg-neutral-800 text-sm font-medium text-neutral-400 cursor-not-allowed">Claim (WIP)</button>
          </div>
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-6 backdrop-blur">
            <h2 className="text-sm font-medium tracking-wide text-neutral-300">Related Listings</h2>
            <ul className="mt-4 space-y-2 text-xs text-neutral-500">
              <li>Lookup coming soon.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
