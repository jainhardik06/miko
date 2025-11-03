"use client";
import { TreeList } from '../../../components/TreeList';
import { useState } from 'react';

export default function FarmerDashboard() {
  const [showListModal, setShowListModal] = useState(false);
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 space-y-12">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Farmer Dashboard</h1>
          <p className="mt-2 text-neutral-400 text-sm max-w-xl leading-relaxed">Manage your approved TreeNFT grants, track minted CCT balances, and prepare marketplace listings. Future versions will surface predictive analytics & variance risk signals.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>setShowListModal(true)} className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium shadow shadow-emerald-600/30">List Credits</button>
          <button className="px-5 py-2 rounded-md bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-sm font-medium">Refresh</button>
        </div>
      </header>
      <section className="space-y-6">
        <h2 className="text-sm font-medium tracking-wide uppercase text-neutral-400">Your Trees</h2>
        <TreeList />
      </section>
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setShowListModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800/70 bg-neutral-950/90 backdrop-blur p-6 space-y-5">
            <h3 className="text-lg font-semibold tracking-tight">Create Listing</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">UI placeholder: select amount & price. This will integrate with listing entry function and wallet signing flow.</p>
            <div className="flex flex-col gap-3 text-sm">
              <input placeholder="Amount" className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none" />
              <input placeholder="Unit Price" className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">Submit</button>
              <button onClick={()=>setShowListModal(false)} className="px-4 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
