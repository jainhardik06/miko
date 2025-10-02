"use client";
import { useEffect, useState } from 'react';
import { computeListingStats } from '@/lib/aptos';

export default function TransparencyDashboard() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([
    { label: 'Streaming Rate (CCT / hr)', value: '—' },
    { label: '24h Claims', value: '—' },
    { label: 'Circulating CCT', value: '—' },
    { label: 'Avg Listing Price', value: '—' }
  ]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stats = await computeListingStats();
        if (!mounted) return;
        // Placeholder derivations for streaming + circulating until proper view fns available
        setCards([
          { label: 'Streaming Rate (CCT / hr)', value: '—' },
          { label: '24h Claims', value: '0' },
          { label: 'Circulating CCT', value: String(stats.totalRemaining) },
          { label: 'Avg Listing Price', value: String(stats.avgPrice) }
        ]);
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 space-y-16">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Live Transparency</h1>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">Protocol‑level telemetry for market integrity and accrual performance. Data surfaces will wire to indexer + oracle feed.</p>
      </header>
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl bg-neutral-900/40 border border-neutral-800/60 p-5 backdrop-blur relative">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">{c.label}</span>
            <p className="mt-2 text-2xl font-mono">{c.value}</p>
            {loading && <div className="absolute inset-0 bg-neutral-950/40 flex items-center justify-center text-[10px] text-neutral-500">Loading…</div>}
          </div>
        ))}
      </section>
      <section className="grid gap-10 md:grid-cols-2">
        <div className="rounded-2xl h-72 bg-neutral-950 border border-neutral-800/70 flex items-center justify-center text-xs text-neutral-600">Claim Volume Chart Placeholder</div>
        <div className="rounded-2xl h-72 bg-neutral-950 border border-neutral-800/70 flex items-center justify-center text-xs text-neutral-600">Price Distribution Placeholder</div>
        <div className="rounded-2xl h-72 bg-neutral-950 border border-neutral-800/70 flex items-center justify-center text-xs text-neutral-600 md:col-span-2">Network Graph / Role Activity Placeholder</div>
      </section>
    </main>
  );
}
