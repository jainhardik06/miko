"use client";
import dynamic from 'next/dynamic';
const HeroScene = dynamic(()=>import('@/components/HeroScene'), { ssr:false, loading: ()=> <div className="h-[60vh] flex items-center justify-center text-xs text-neutral-500">Loading scene…</div> });
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchListings, buyCCT, fetchListing, Listing, TxResult, MICRO_UNITS } from '@/lib/aptos';
import { useToast } from '@/components/ToastProvider';
import { useMikoStore } from '@/state/store';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchWalletSummary, buyWithMikoWallet, createPurchaseOrder } from '@/lib/walletClient';

const formatINR = (value: number): string => {
  const rupees = Number.isFinite(value) ? value : 0;
  return `₹ ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const paiseToRupees = (paise: number): number => (Number.isFinite(paise) ? paise : 0) / 100;

async function loadRazorpayCheckout(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  if ((window as any).Razorpay) return (window as any).Razorpay;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
  return (window as any).Razorpay || null;
}

interface WalletSummaryData {
  balancePaise: number;
  balanceInr: number;
  updatedAt?: string;
  wallets?: { address: string }[];
}

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
  const { user, methods, token } = useAuth();
  const [walletSummary, setWalletSummary] = useState<WalletSummaryData | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [purchaseListing, setPurchaseListing] = useState<Listing | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState<'wallet' | 'razorpay' | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState<string>('1');
  const isCorporate = user?.role === 'CORPORATE';
  const linkedAptosWallet = walletSummary?.wallets?.[0]?.address || methods?.wallets?.[0]?.address || account || null;

  // UI model: enrich listings with profile-like details for display
  type UIListing = Listing & { username: string; location: string; demo?: boolean };
  const staticDemo: UIListing[] = useMemo(()=>[
    { id: -1, seller: '0xDEMO01', remaining_micro: 120 * MICRO_UNITS, remaining_tokens: 120, unit_price: 12, created_at: Date.now(), username: 'Gopal Sharma', location: 'Jaipur, Rajasthan', demo: true },
    { id: -2, seller: '0xDEMO02', remaining_micro: 75 * MICRO_UNITS, remaining_tokens: 75, unit_price: 15, created_at: Date.now(), username: 'Priya Verma', location: 'Bikaner, Rajasthan', demo: true },
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

  function parsePositiveInt(v: string, field: string, maxTokens?: number): number | null {
    if (!v.trim()) { setErrors(e=>({...e,[field]:'Required'})); return null; }
    if (!/^[0-9]+$/.test(v)) { setErrors(e=>({...e,[field]:'Digits only'})); return null; }
    const n = parseInt(v, 10);
    if (n <= 0) { setErrors(e=>({...e,[field]:'Must be > 0'})); return null; }
    if (maxTokens !== undefined && n > maxTokens) {
      setErrors(e=>({...e,[field]:`Max ${maxTokens}`}));
      return null;
    }
  setErrors(e=>{ const copy = { ...e }; delete (copy as Record<string,string>)[field]; return copy; });
    return n;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await fetchListings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const i = setInterval(() => { void load(); }, 10000);
    return () => clearInterval(i);
  }, [load]);

  const refreshWalletSummary = useCallback(async () => {
    if (!token) return;
    try {
      setWalletLoading(true);
      setWalletStatus(null);
      const summary = await fetchWalletSummary(token);
      setWalletSummary({
        balancePaise: summary?.balancePaise ?? 0,
        balanceInr: summary?.balanceInr ?? paiseToRupees(summary?.balancePaise ?? 0),
        updatedAt: summary?.updatedAt,
        wallets: summary?.wallets ?? []
      });
    } catch (error: any) {
      console.error('[Marketplace] Wallet summary load failed:', error);
      setWalletStatus(error?.message || 'Failed to load wallet summary');
      setWalletSummary(null);
    } finally {
      setWalletLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isCorporate || !token) {
      setWalletSummary(null);
      setWalletStatus(null);
      return;
    }
    void refreshWalletSummary();
  }, [isCorporate, token, refreshWalletSummary]);

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

  const handleCorporateWalletPurchase = useCallback(async (listing: Listing, quantity: number) => {
    if (!token) {
      setPurchaseError('Session expired. Please log in again.');
      return;
    }
    if (!linkedAptosWallet) {
      setPurchaseError('Link an Aptos wallet before purchasing tokens.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPurchaseError('Enter a whole number of tokens to purchase.');
      return;
    }
    if (quantity > Math.round(listing.remaining_tokens)) {
      setPurchaseError('Quantity exceeds available tokens in this listing.');
      return;
    }
    const totalPaise = Math.round(quantity * listing.unit_price * 100);
    const balancePaise = walletSummary?.balancePaise ?? 0;
    if (balancePaise < totalPaise) {
      setPurchaseError('Insufficient Miko wallet balance for this purchase.');
      return;
    }
    try {
      setPurchaseBusy('wallet');
      setPurchaseError(null);
      await buyWithMikoWallet(token, { listingId: listing.id, quantityTokens: quantity });
      setPurchaseStatus(`Wallet purchase submitted for listing #${listing.id}. Tokens will transfer after settlement.`);
      setPurchaseListing(null);
      push({ message: 'Wallet payment initiated', type: 'success' });
      await refreshWalletSummary();
      await load();
    } catch (error: any) {
      console.error('[Marketplace] Wallet purchase failed:', error);
      setPurchaseError(error?.message || 'Failed to complete wallet purchase');
    } finally {
      setPurchaseBusy(null);
    }
  }, [token, linkedAptosWallet, walletSummary?.balancePaise, refreshWalletSummary, load, push]);

  const handleCorporateRazorpayPurchase = useCallback(async (listing: Listing, quantity: number) => {
    if (!token) {
      setPurchaseError('Session expired. Please log in again.');
      return;
    }
    if (!linkedAptosWallet) {
      setPurchaseError('Link an Aptos wallet before purchasing tokens.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPurchaseError('Enter a whole number of tokens to purchase.');
      return;
    }
    if (quantity > Math.round(listing.remaining_tokens)) {
      setPurchaseError('Quantity exceeds available tokens in this listing.');
      return;
    }
    try {
      setPurchaseBusy('razorpay');
      setPurchaseError(null);
      const order = await createPurchaseOrder(token, { listingId: listing.id, quantityTokens: quantity });
      const RazorpayCtor = await loadRazorpayCheckout();
      if (!RazorpayCtor) {
        throw new Error('Unable to initialize Razorpay checkout.');
      }
      const checkout = new RazorpayCtor({
        key: order.key,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Miko Marketplace Purchase',
        description: `Listing #${listing.id}`,
        order_id: order.orderId,
        handler: () => {
          setPurchaseStatus('Payment captured. Token transfer is being processed.');
          push({ message: 'Razorpay payment captured', type: 'success' });
          void refreshWalletSummary();
          void load();
        },
        prefill: {
          email: user?.email || undefined,
          name: user?.username || undefined
        },
        notes: {
          listingId: String(listing.id),
          purchaseId: order.purchaseId
        }
      });
      checkout.open();
      setPurchaseStatus('Complete the Razorpay payment window to finish the purchase.');
      setPurchaseListing(null);
    } catch (error: any) {
      console.error('[Marketplace] Razorpay purchase failed:', error);
      setPurchaseError(error?.message || 'Failed to start Razorpay checkout');
    } finally {
      setPurchaseBusy(null);
    }
  }, [token, linkedAptosWallet, refreshWalletSummary, load, user?.email, user?.username, push]);

  const beginCorporatePurchase = useCallback((listing: Listing) => {
    setPurchaseListing(listing);
    setPurchaseQuantity('1');
    setPurchaseError(null);
    setPurchaseStatus(null);
    setPurchaseBusy(null);
    if (!walletSummary && !walletLoading) {
      void refreshWalletSummary();
    }
  }, [walletSummary, walletLoading, refreshWalletSummary]);

  const closePurchaseModal = useCallback(() => {
    setPurchaseListing(null);
    setPurchaseQuantity('1');
    setPurchaseError(null);
    setPurchaseStatus(null);
    setPurchaseBusy(null);
  }, []);

  const selectedQuantity = useMemo(() => {
    if (!purchaseListing) return 0;
    if (!purchaseQuantity.trim()) return 0;
    const parsed = parseInt(purchaseQuantity, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [purchaseListing, purchaseQuantity]);

  const purchaseLimit = purchaseListing ? Math.round(purchaseListing.remaining_tokens) : 0;
  const quantityValid = purchaseListing ? Number.isInteger(selectedQuantity) && selectedQuantity > 0 && selectedQuantity <= purchaseLimit : false;
  const totalCostRupees = purchaseListing ? selectedQuantity * purchaseListing.unit_price : 0;
  const walletBalanceRupees = walletSummary ? paiseToRupees(walletSummary.balancePaise) : 0;

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
                      <td className="px-3 py-2">{l.remaining_tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-2">₹ {l.unit_price}</td>
                      <td className="px-3 py-2">
                        {!l.demo ? (
                          isCorporate ? (
                            <button
                              onClick={()=>beginCorporatePurchase(l)}
                              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs disabled:opacity-40"
                              disabled={purchaseBusy !== null}
                            >Purchase</button>
                          ) : account && account!==l.seller ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={quantities[l.id]||''}
                                onChange={e=>{ const v = e.target.value; if(!/^[0-9]*$/.test(v)) return; setQuantities(q=>({...q,[l.id]:v})); }}
                                placeholder="Qty"
                                className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-xs focus:outline-none"
                              />
                              <button
                                onClick={()=>{ const raw = parsePositiveInt(quantities[l.id]||'0','qty'+l.id, Math.round(l.remaining_tokens)); if(raw==null) return; buy(l.id, raw); }}
                                disabled={buyingId===l.id||l.remaining_tokens <= 0}
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs disabled:opacity-40"
                              >{buyingId===l.id?'Buying…':'Buy Now'}</button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-500">Not available</span>
                          )
                        ) : (
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
                      <div className="text-lg font-semibold">{l.remaining_tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-400">Unit Price</div>
                      <div className="text-lg font-semibold">₹ {l.unit_price}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {!l.demo ? (
                      isCorporate ? (
                        <button
                          onClick={()=>beginCorporatePurchase(l)}
                          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-40"
                          disabled={purchaseBusy !== null}
                        >Purchase</button>
                      ) : account && account!==l.seller ? (
                        <>
                          <input
                            value={quantities[l.id]||''}
                            onChange={e=>{ const v = e.target.value; if(!/^[0-9]*$/.test(v)) return; setQuantities(q=>({...q,[l.id]:v})); }}
                            placeholder="Qty"
                            className="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs focus:outline-none"
                          />
                          <button
                            onClick={()=>{ const raw = parsePositiveInt(quantities[l.id]||'0','qty'+l.id, Math.round(l.remaining_tokens)); if(raw==null) return; buy(l.id, raw); }}
                            disabled={buyingId===l.id||l.remaining_tokens <= 0}
                            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-40"
                          >{buyingId===l.id?'Buying…':'Buy Now'}</button>
                        </>
                      ) : (
                        <span className="text-[11px] text-neutral-500">Not available</span>
                      )
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
      {purchaseListing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">Confirm Purchase</h3>
                <p className="mt-1 text-xs text-neutral-400">Listing #{purchaseListing.id} · {purchaseListing.remaining_tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens remaining</p>
              </div>
              <button onClick={closePurchaseModal} className="text-neutral-400 hover:text-neutral-200 text-sm">Close</button>
            </div>
            <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Unit price</span>
                <span className="font-medium">{formatINR(purchaseListing.unit_price)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-neutral-400">Quantity</span>
                <div className="flex items-center gap-2">
                  <input
                    value={purchaseQuantity}
                    onChange={e => {
                      const raw = e.target.value.trim();
                      if (raw === '' || /^[0-9]+$/.test(raw)) {
                        setPurchaseQuantity(raw || '');
                      }
                    }}
                    placeholder="Tokens"
                    className="w-24 rounded border border-neutral-700 bg-neutral-950 px-3 py-1 text-right text-sm focus:outline-none"
                  />
                  <span className="text-[11px] text-neutral-500">Max {purchaseLimit.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-neutral-400">Total payable</span>
                <span className="text-base font-semibold">{formatINR(totalCostRupees)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-neutral-400">
              <div className="flex items-center justify-between text-sm">
                <span>Miko wallet balance</span>
                <span className="font-medium text-neutral-100">{walletLoading ? 'Loading…' : formatINR(walletBalanceRupees)}</span>
              </div>
              {walletStatus && <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">{walletStatus}</div>}
              {purchaseError && <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-200 text-sm">{purchaseError}</div>}
              {purchaseStatus && <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-200 text-sm">{purchaseStatus}</div>}
              <p>Funds will be debited from your selected payment method and routed to the seller&apos;s wallet. Token transfer finalises after on-chain settlement.</p>
              {!linkedAptosWallet && (
                <p className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200">Link an Aptos wallet in your profile to complete purchases.</p>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!quantityValid || purchaseBusy === 'wallet'}
                onClick={() => {
                  if (purchaseListing && quantityValid) {
                    void handleCorporateWalletPurchase(purchaseListing, selectedQuantity);
                  }
                }}
              >{purchaseBusy === 'wallet' ? 'Processing…' : 'Pay with Miko Wallet'}</button>
              <button
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!quantityValid || purchaseBusy === 'razorpay'}
                onClick={() => {
                  if (purchaseListing && quantityValid) {
                    void handleCorporateRazorpayPurchase(purchaseListing, selectedQuantity);
                  }
                }}
              >{purchaseBusy === 'razorpay' ? 'Opening Razorpay…' : 'Pay with Razorpay'}</button>
            </div>

            <p className="mt-4 text-[11px] text-neutral-500">Need help? Contact support with the listing ID and your payment reference.</p>
          </div>
        </div>
      )}
    </main>
  );
}
