"use client";
import { useState } from 'react';

const farmerSteps = [
  { title: 'Onboard & Submit', desc: 'Register land & upload geospatial + photographic evidence (to IPFS).' },
  { title: 'Validation', desc: 'Validator reviews request; admin approves the TreeNFT grant.' },
  { title: 'Immediate Mint', desc: 'Approval mints the full CCT grant straight into the farmer’s wallet.' },
  { title: 'List & Sell', desc: 'Farmer sets a listing at the fixed ₹500/CCT rate in the marketplace.' },
  { title: 'Liquidity Access', desc: 'Credits are sold to industries seeking verified offsets.' }
];
const industrySteps = [
  { title: 'Connect & Discover', desc: 'Browse transparent listings & asset metadata (origin, species, grant amount).' },
  { title: 'Due Diligence', desc: 'Inspect validation history, grant records & monitoring data.' },
  { title: 'Purchase Credits', desc: 'Execute on-chain buy; funds transfer instantly for the CCT lot.' },
  { title: 'Offset Accounting', desc: 'Track portfolio & retirement schedule in dashboard.' },
  { title: 'Reporting & Proofs', desc: 'Export cryptographic receipts & attestation bundles.' }
];

export default function HowItWorks() {
  const [mode, setMode] = useState<'farmer' | 'industry'>('farmer');
  const steps = mode === 'farmer' ? farmerSteps : industrySteps;
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">How It Works</h1>
        <p className="mt-3 text-neutral-400 text-sm leading-relaxed">Dual‑sided flow: farmer asset onboarding & industry offset procurement. Each phase will gain automation in later protocol versions.</p>
      </header>
      <div className="mt-10 inline-flex rounded-lg overflow-hidden border border-neutral-800/60 bg-neutral-900/40 backdrop-blur">
        <button onClick={()=>setMode('farmer')} className={`px-5 py-2 text-xs font-medium tracking-wide transition ${mode==='farmer' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>Farmer Path</button>
        <button onClick={()=>setMode('industry')} className={`px-5 py-2 text-xs font-medium tracking-wide transition ${mode==='industry' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>Industry Path</button>
      </div>
      <ol className="mt-12 grid gap-8 md:grid-cols-2">
        {steps.map((s,i) => (
          <li key={i} className="group relative rounded-xl border border-neutral-800/60 bg-neutral-900/30 p-6 backdrop-blur overflow-hidden">
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-emerald-600/10 blur-2xl group-hover:bg-emerald-500/20 transition" />
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold font-mono">{i+1}</span>
            <h2 className="mt-4 font-medium tracking-tight">{s.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">{s.desc}</p>
            <div className="mt-4 h-10 rounded-md border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500">Animation Slot</div>
          </li>
        ))}
      </ol>
    </main>
  );
}
