"use client";
import dynamic from 'next/dynamic';
const HeroScene = dynamic(()=>import('@/components/HeroScene'), { ssr:false, loading: ()=> <div className="h-[60vh] flex items-center justify-center text-xs text-neutral-500">Loading scene…</div> });
import { useEffect, useState } from 'react';
import { fetchListings, listTokensTx, buyCCT, fetchListing, Listing, TxResult } from '@/lib/aptos';
import { useToast } from '@/components/ToastProvider';
import { useMikoStore } from '@/state/store';

export default function MarketplacePage() {
  const account = useMikoStore(s => s.account);
  const signAndSubmitTransaction = async (_tx: unknown)=>{ console.warn('Marketplace: TODO integrate direct Aptos tx submit'); return { hash:'0xPLACEHOLDER' } as TxResult; };
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const { push } = useToast();
  const [quantities, setQuantities] = useState<Record<number,string>>({});
  const [form, setForm] = useState({ amount: '', price: '' });
  const [errors, setErrors] = useState<Record<string,string>>({});

  function parsePositiveInt(v: string, field: string, max?: number): number | null {
    if (!v.trim()) { setErrors(e=>({...e,[field]:'Required'})); return null; }
    if (!/^[0-9]+$/.test(v)) { setErrors(e=>({...e,[field]:'Digits only'})); return null; }
    const n = parseInt(v, 10);
    if (n <= 0) { setErrors(e=>({...e,[field]:'Must be > 0'})); return null; }
    if (max && n > max) { setErrors(e=>({...e,[field]:`Max ${max}`})); return null; }
  setErrors(e=>{ const copy = { ...e }; delete (copy as Record<string,string>)[field]; return copy; });
    return n;
  }

  async function load() {
    setLoading(true);
    try { setListings(await fetchListings()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  async function createListing() {
    if (!account) return;
  const amount = parsePositiveInt(form.amount,'amount');
  const price = parsePositiveInt(form.price,'price');
  if (amount==null || price==null) return;
    setCreating(true);
    try {
    setTxStatus('Submitting listing…'); push({ message: 'Submitting listing…', type:'info'});
  const tx = listTokensTx(account, amount, price);
  const pending: TxResult = await signAndSubmitTransaction(tx);
  setTxStatus('Submitted: ' + pending.hash.slice(0,10) + '… confirming'); push({ message: 'Listing tx submitted', type:'success'});
  // optimistic refresh; could poll transaction later
  setForm({ amount: '', price: '' });
  load();
  setTxStatus('Listing submitted');
    } finally { setCreating(false); }
  }

  async function buy(listingId: number, qty: number) {
    if (!account) return;
    setBuyingId(listingId);
    try {
    setTxStatus(`Buying ${qty} from #${listingId}…`); push({ message: `Buying ${qty} tokens`, type:'info'});
  const tx = buyCCT(account, listingId, qty);
  const pending: TxResult = await signAndSubmitTransaction(tx);
  setTxStatus('Tx ' + pending.hash.slice(0,10) + '… executing'); push({ message: 'Buy transaction submitted', type:'success'});
      // incremental single fetch
      const updated = await fetchListing(listingId);
      setListings(cur => {
        if (!updated) return cur.filter(l => l.id !== listingId); // fulfilled
        return cur.map(l => l.id === listingId ? updated : l);
      });
  setTxStatus(`Buy complete for #${listingId}`); push({ message: 'Buy complete', type:'success'});
    } finally { setBuyingId(null); }
  }

  return (
    <main className="min-h-screen w-full">
      <section className="border-b border-neutral-800/40">
        <HeroScene />
      </section>
      <section className="mx-auto max-w-7xl px-6 py-16 space-y-12">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-3 text-sm text-neutral-400">List and purchase CCT credits. Prototype only – no economic guarantees.</p>
        </header>
        <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/30 backdrop-blur px-5 py-4 flex flex-wrap gap-4 items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Sort:</span>
            <select className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 outline-none">
              <option>Newest</option>
              <option>Price Asc</option>
              <option>Price Desc</option>
              <option>Remaining</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Min Remaining:</span>
            <input className="w-20 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs outline-none" placeholder="0" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Seller:</span>
            <input className="w-40 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs outline-none" placeholder="0x…" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Apply</button>
            <button className="px-3 py-1 rounded bg-neutral-900 border border-neutral-700 hover:bg-neutral-800">Reset</button>
          </div>
        </div>
        <div className="grid gap-12 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-sm font-medium mb-3">Create Listing</h2>
            <div className="space-y-3 text-sm">
              <div>
                <input value={form.amount} onChange={e=>setForm(f=>({...f, amount:e.target.value}))} placeholder="Amount" className={`w-full rounded bg-neutral-900 border px-3 py-2 text-sm outline-none ${errors.amount? 'border-red-600':'border-neutral-700'}`}/>
                {errors.amount && <p className="mt-1 text-[10px] text-red-500">{errors.amount}</p>}
              </div>
              <div>
                <input value={form.price} onChange={e=>setForm(f=>({...f, price:e.target.value}))} placeholder="Unit Price" className={`w-full rounded bg-neutral-900 border px-3 py-2 text-sm outline-none ${errors.price? 'border-red-600':'border-neutral-700'}`}/>
                {errors.price && <p className="mt-1 text-[10px] text-red-500">{errors.price}</p>}
              </div>
              <button disabled={!account||creating} onClick={createListing} className="w-full rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 py-2 text-sm font-medium">{creating? 'Listing…':'List'}</button>
              {!account && <p className="text-xs text-neutral-500">Connect wallet to list.</p>}
            </div>
          </div>
          <div className="md:col-span-2">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">Active Listings {loading && <span className="text-[10px] text-neutral-500">(refreshing)</span>}</h2>
            <div className="overflow-x-auto rounded border border-neutral-800/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900/60 text-neutral-400 text-xs">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Seller</th>
                    <th className="px-3 py-2">Remaining</th>
                    <th className="px-3 py-2">Unit Price</th>
                    <th className="px-3 py-2">Buy</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(l => (
                    <tr key={l.id} className="border-t border-neutral-800/40">
                      <td className="px-3 py-2 font-mono text-xs">{l.id}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">{l.seller.slice(0,6)}…{l.seller.slice(-4)}</td>
                      <td className="px-3 py-2">{l.remaining}</td>
                      <td className="px-3 py-2">{l.unit_price}</td>
                      <td className="px-3 py-2 space-x-2">
                        {account && account!==l.seller && (
                          <>
                            <input
                              value={quantities[l.id]||''}
                              onChange={e=>{
                                const v = e.target.value; if(!/^[0-9]*$/.test(v)) return; setQuantities(q=>({...q,[l.id]:v}));
                              }}
                              placeholder="Qty"
                              className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 text-xs focus:outline-none"
                            />
                            <button
                              onClick={()=>{
                                const raw = parsePositiveInt(quantities[l.id]||'0','qty'+l.id, l.remaining); if(raw==null) return; buy(l.id, raw);
                              }}
                              disabled={buyingId===l.id||l.remaining===0}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs disabled:opacity-40"
                            >{buyingId===l.id?'Buying…':'Buy'}</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {listings.length===0 && !loading && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-neutral-500">No listings</td></tr>
                  )}
                </tbody>
              </table>
              {txStatus && <div className="px-3 py-2 text-[11px] text-neutral-500 border-t border-neutral-800/60">{txStatus}</div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
