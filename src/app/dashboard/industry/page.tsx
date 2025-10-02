export default function IndustryDashboard() {
  const portfolio = [
    { id: 1, source: 'Listing #12', amount: 120, ts: '—' },
    { id: 2, source: 'Listing #7', amount: 40, ts: '—' }
  ];
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 space-y-14">
      <header className="space-y-4 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Industry Dashboard</h1>
        <p className="text-neutral-400 text-sm leading-relaxed">Monitor portfolio performance, offsets progress and acquisition history. Future releases will integrate automated retirement attestations & emissions ledger import.</p>
      </header>
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-800/60 p-6 bg-neutral-900/40 backdrop-blur">
          <h2 className="font-medium text-sm tracking-wide text-neutral-300">Current Holdings</h2>
          <p className="mt-4 text-4xl font-mono">0<span className="text-sm ml-2 font-normal">CCT</span></p>
        </div>
        <div className="rounded-xl border border-neutral-800/60 p-6 bg-neutral-900/40 backdrop-blur">
          <h2 className="font-medium text-sm tracking-wide text-neutral-300">Retired (Total)</h2>
          <p className="mt-4 text-4xl font-mono">0<span className="text-sm ml-2 font-normal">CCT</span></p>
        </div>
        <div className="rounded-xl border border-neutral-800/60 p-6 bg-neutral-900/40 backdrop-blur">
          <h2 className="font-medium text-sm tracking-wide text-neutral-300">Goal Progress</h2>
          <div className="mt-5 h-3 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full w-[0%] bg-gradient-to-r from-emerald-500 to-emerald-300" />
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">0% of annual offset target</p>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">Portfolio Lots</h2>
        <div className="overflow-x-auto rounded border border-neutral-800/60">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-xs text-neutral-400">
              <tr>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Amount</th>
                <th className="px-3 py-2 text-left">Acquired</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map(p => (
                <tr key={p.id} className="border-t border-neutral-800/50">
                  <td className="px-3 py-2 font-mono text-xs">{p.source}</td>
                  <td className="px-3 py-2">{p.amount}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{p.ts}</td>
                </tr>
              ))}
              {portfolio.length===0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-neutral-500">No acquisitions yet.</td></tr>}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[11px] text-neutral-500 border-t border-neutral-800/60">Historical ledger placeholder</div>
        </div>
      </section>
    </main>
  );
}
