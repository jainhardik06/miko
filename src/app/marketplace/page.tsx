"use client";
import dynamic from 'next/dynamic';
const HeroScene = dynamic(()=>import('@/components/HeroScene'), { ssr:false, loading: ()=> <div className="h-[60vh] flex items-center justify-center text-xs text-neutral-500">Loading scene…</div> });
import { useEffect, useMemo, useState } from 'react';
import { fetchListings, buyCCT, fetchListing, Listing, TxResult } from '@/lib/aptos';
import { useToast } from '@/components/ToastProvider';
import { useMikoStore } from '@/state/store';

export default function MarketplacePage() {
  const account = useMikoStore(s => s.account);
  const signAndSubmitTransaction = async (_tx: unknown)=>{ console.warn('Marketplace: TODO integrate direct Aptos tx submit'); return { hash:'0xPLACEHOLDER' } as TxResult; };
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const { push } = useToast();
  const [quantities, setQuantities] = useState<Record<number,string>>({});
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [viewMode, setViewMode] = useState<'list'|'grid'>('list');

  // UI model: enrich listings with profile-like details for display
  type UIListing = Listing & { username: string; location: string; demo?: boolean };
  const staticDemo: UIListing[] = useMemo(()=>[
    { id: -1, seller: '0xDEMO01', remaining: 120, unit_price: 12, created_at: Date.now(), username: 'Gopal Sharma', location: 'Jaipur, Rajasthan', demo: true },
    { id: -2, seller: '0xDEMO02', remaining: 75, unit_price: 15, created_at: Date.now(), username: 'Priya Verma', location: 'Bikaner, Rajasthan', demo: true },
  ],[]);

  function addrToUsername(addr: string){
    // Fallback pseudo-username from address
    return `user_${addr.slice(2,6).toLowerCase()}`;
  }
  const indianCities = [
    'Jaipur, Rajasthan','Pune, Maharashtra','Ahmedabad, Gujarat','Varanasi, Uttar Pradesh',
    'Indore, Madhya Pradesh','Kochi, Kerala','Bhubaneswar, Odisha','Nagpur, Maharashtra',
    'Surat, Gujarat','Jodhpur, Rajasthan'
  ];
  function addrToLocation(addr: string){
    const hex = addr.replace(/^0x/,'');
    const n = [...hex].reduce((a,c)=>a + c.charCodeAt(0), 0);
    return indianCities[n % indianCities.length];
  }
  const displayListings: UIListing[] = useMemo(()=>{
    const enriched = listings.map(l => ({
      ...l,
      username: addrToUsername(l.seller),
      location: addrToLocation(l.seller)
    }));
    // Always append demos so UI is visible during development; mark as demo and disable Buy
    return [...staticDemo, ...enriched];
  },[listings, staticDemo]);

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
    <main className="min-h-screen w-full pt-6 md:pt-10">
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
            <div className="h-5 w-px bg-neutral-800 mx-1" />
            <span className="text-neutral-500">View:</span>
            <div className="inline-flex rounded border border-neutral-700 overflow-hidden">
              <button onClick={()=>setViewMode('list')} className={`px-3 py-1 text-xs ${viewMode==='list'?'bg-neutral-800 text-white':'bg-neutral-950 text-neutral-400 hover:text-white'}`}>List</button>
              <button onClick={()=>setViewMode('grid')} className={`px-3 py-1 text-xs ${viewMode==='grid'?'bg-neutral-800 text-white':'bg-neutral-950 text-neutral-400 hover:text-white'}`}>Grid</button>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-sm font-medium mb-1 flex items-center gap-2">Active Listings {loading && <span className="text-[10px] text-neutral-500">(refreshing)</span>}</h2>

          {viewMode==='list' ? (
            <div className="overflow-x-auto rounded border border-neutral-800/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900/60 text-neutral-400 text-xs">
                  <tr>
                    <th className="px-3 py-2">Seller</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Tokens</th>
                    <th className="px-3 py-2">Unit Price</th>
                    <th className="px-3 py-2">Buy</th>
                  </tr>
                </thead>
                <tbody>
                  {displayListings.map(l => (
                    <tr key={l.id} className="border-t border-neutral-800/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-[10px] font-semibold">{l.username.slice(0,1).toUpperCase()}</div>
                          <div className="text-sm">{l.username} {l.demo && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">Demo</span>}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px]">{l.seller.slice(0,6)}…{l.seller.slice(-4)}</td>
                      <td className="px-3 py-2 text-xs text-neutral-300">{l.location}</td>
                      <td className="px-3 py-2">{l.remaining}</td>
                      <td className="px-3 py-2">₹ {l.unit_price}</td>
                      <td className="px-3 py-2 space-x-2">
                        {!l.demo && account && account!==l.seller && (
                          <>
                            <input
                              value={quantities[l.id]||''}
                              onChange={e=>{ const v = e.target.value; if(!/^[0-9]*$/.test(v)) return; setQuantities(q=>({...q,[l.id]:v})); }}
                              placeholder="Qty"
                              className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-xs focus:outline-none"
                            />
                            <button
                              onClick={()=>{ const raw = parsePositiveInt(quantities[l.id]||'0','qty'+l.id, l.remaining); if(raw==null) return; buy(l.id, raw); }}
                              disabled={buyingId===l.id||l.remaining===0}
                              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs disabled:opacity-40"
                            >{buyingId===l.id?'Buying…':'Buy Now'}</button>
                          </>
                        )}
                        {l.demo && (
                          <button disabled className="px-3 py-1 rounded bg-neutral-800 text-neutral-400 text-xs">Buy (demo)</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txStatus && <div className="px-3 py-2 text-[11px] text-neutral-500 border-t border-neutral-800/60">{txStatus}</div>}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayListings.map(l => (
                <div key={l.id} className="rounded-xl border border-neutral-800/60 bg-neutral-950/60 p-4 hover:border-neutral-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-sm font-semibold">{l.username.slice(0,1).toUpperCase()}</div>
                      <div>
                        <div className="font-medium">{l.username} {l.demo && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">Demo</span>}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">{l.seller.slice(0,6)}…{l.seller.slice(-4)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-neutral-300">Location</div>
                  <div className="text-sm">{l.location}</div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-neutral-400">Tokens</div>
                      <div className="text-lg font-semibold">{l.remaining}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-400">Unit Price</div>
                      <div className="text-lg font-semibold">₹ {l.unit_price}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {!l.demo && account && account!==l.seller ? (
                      <>
                        <input
                          value={quantities[l.id]||''}
                          onChange={e=>{ const v = e.target.value; if(!/^[0-9]*$/.test(v)) return; setQuantities(q=>({...q,[l.id]:v})); }}
                          placeholder="Qty"
                          className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs focus:outline-none"
                        />
                        <button
                          onClick={()=>{ const raw = parsePositiveInt(quantities[l.id]||'0','qty'+l.id, l.remaining); if(raw==null) return; buy(l.id, raw); }}
                          disabled={buyingId===l.id||l.remaining===0}
                          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-40"
                        >{buyingId===l.id?'Buying…':'Buy Now'}</button>
                      </>
                    ) : (
                      <button disabled className="px-3 py-2 rounded bg-neutral-800 text-neutral-400 text-sm w-full sm:w-auto">Buy (demo)</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
