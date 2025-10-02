export default function AboutPage() {
  const principles = [
    { title: 'Farmer‑First Incentives', desc: 'Yield & carbon finance should accrue to the ecological steward at the edge—not just centralized aggregators.' },
    { title: 'Transparent Accrual', desc: 'Continuous, parameterized emission logic > opaque batch issuance cycles.' },
    { title: 'Composable Primitives', desc: 'Credits, risk buffers, staking escrows and governance weights are first‑class resources.' },
    { title: 'Progressive Decentralization', desc: 'Start with curated roles; converge toward credibly neutral verification flows.' }
  ];
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 space-y-16">
      <header className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">About Miko</h1>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">Miko is constructing a cryptographic substrate for verifiable ecological asset monetization: on‑chain TreeNFT digital twins stream carbon credit tokens (CCT) governed by transparent oracle parameters. The objective: unlock regenerative capital flows for India’s smallholders while preserving auditability and open data integrity.</p>
      </header>
      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Mission</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">Empower distributed ecological stewards to directly access global climate finance—without sacrificing measurement rigor, sovereignty, or transparency.</p>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Vision</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">A permission‑minimized green economy where tokenized biomass, soil, water and biodiversity flows interoperate across public ledgers & AI validation networks.</p>
        </div>
      </section>
      <section className="space-y-6">
        <h2 className="text-xl font-medium">Principles</h2>
        <ul className="grid gap-6 md:grid-cols-2">
          {principles.map(p => (
            <li key={p.title} className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-5 backdrop-blur">
              <h3 className="text-sm font-semibold tracking-tight mb-2">{p.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{p.desc}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-5">
        <h2 className="text-xl font-medium">Roadmap Snapshot</h2>
        <div className="grid gap-4 text-xs text-neutral-500 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-800/50 p-4 bg-neutral-900/30">
            <h3 className="font-medium text-neutral-300 mb-1">Phase 0</h3>
            <p>Accrual & listing primitives, request separation.</p>
          </div>
          <div className="rounded-lg border border-neutral-800/50 p-4 bg-neutral-900/30">
            <h3 className="font-medium text-neutral-300 mb-1">Phase 1</h3>
            <p>MVP marketplace, oracle, dashboards.</p>
          </div>
          <div className="rounded-lg border border-neutral-800/50 p-4 bg-neutral-900/30">
            <h3 className="font-medium text-neutral-300 mb-1">Phase 2</h3>
            <p>Staking, insurance pool, AI pre‑validation.</p>
          </div>
          <div className="rounded-lg border border-neutral-800/50 p-4 bg-neutral-900/30">
            <h3 className="font-medium text-neutral-300 mb-1">Phase 3+</h3>
            <p>Mobile capture, multi‑asset, DAO governance.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
