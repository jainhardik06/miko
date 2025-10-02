"use client";
import { useEffect, useState } from 'react';
import { computeListingStats } from '@/lib/aptos';

export default function MarketplaceOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ label: string; value: string }[]>([
    { label: 'Active Listings', value: '—' },
    { label: 'Total Remaining CCT', value: '—' },
    { label: 'Avg Unit Price', value: '—' },
    { label: 'Highest Unit Price', value: '—' }
  ]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await computeListingStats();
        if (!mounted) return;
        setStats([
          { label: 'Active Listings', value: String(s.count) },
          { label: 'Total Remaining CCT', value: String(s.totalRemaining) },
          { label: 'Avg Unit Price', value: String(s.avgPrice) },
          { label: 'Highest Unit Price', value: String(s.highest) }
        ]);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 space-y-16">
      <header className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-semibold tracking-tight">Marketplace Transparency</h1>
        <p className="mt-4 text-sm text-neutral-400 leading-relaxed">A public snapshot of ecological asset flows, liquidity and participation. Live data wiring pending oracle/indexer integration.</p>
      </header>
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 relative">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-neutral-900/40 border border-neutral-800/60 p-5 backdrop-blur relative overflow-hidden">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">{s.label}</span>
            <p className="mt-2 text-2xl font-mono">{s.value}</p>
            {loading && <div className="absolute inset-0 bg-neutral-950/40 flex items-center justify-center text-[10px] text-neutral-500">Loading…</div>}
          </div>
        ))}
      </section>
      <section className="space-y-6">
        <h2 className="text-xl font-medium">Geospatial Activity</h2>
        <div className="relative h-[480px] rounded-2xl bg-neutral-950 border border-neutral-800/70 flex items-center justify-center text-xs text-neutral-600">
          3D Globe Placeholder • Will show mint & claim pulses
        </div>
      </section>
      <section className="space-y-6">
        <h2 className="text-xl font-medium">Recent Activity</h2>
        <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-6 text-xs text-neutral-500">
          Event feed placeholder (LIST / BUY / CLAIM events)
        </div>
      </section>
    </main>
  );
}
