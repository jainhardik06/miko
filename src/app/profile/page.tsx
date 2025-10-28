"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../components/auth/AuthProvider';
import { fetchWalletChallenge, linkEmailRequest, linkEmailVerify, linkWallet, linkGoogleInitUrl, updateCurrentUser, deleteAccount } from '../../lib/authClient';
import { connectPetra, signMessagePetra } from '../../lib/petra';
import ThemeToggle from '../../components/ThemeToggle';
import { MODULE_ADDRESS, getConfig } from '../../config';
import type { Tree, Request } from '../../lib/aptos';

const API = getConfig().apiOrigin;

interface ProfileStats {
  treesApproved: number;
  treesPending: number;
  treesRejected: number;
  totalCCT: number;
}

interface BackendTree {
  _id: string;
  blockchainRequestId: number;
  blockchainTreeId?: number;
  metadataUri: string;
  cctGranted: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
}

export default function ProfilePage(){
  const { user, methods, token, refresh, logout } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string| null>(null);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  
  // Backend data (supplementary stats only)
  const [stats, setStats] = useState<ProfileStats>({ treesApproved: 0, treesPending: 0, treesRejected: 0, totalCCT: 0 });
  const [backendTrees, setBackendTrees] = useState<BackendTree[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);
  
  // Blockchain data (PRIMARY source - shows all requests)
  const [trees, setTrees] = useState<Tree[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loadingOnchain, setLoadingOnchain] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null)
  
  const [sellOpen, setSellOpen] = useState(false);
  const [sellAmount, setSellAmount] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(1);
  const [sellSubmitting, setSellSubmitting] = useState(false);

  useEffect(()=>{ setUsername(user?.username || ''); }, [user?.username]);

  const canSave = useMemo(()=> token && username && username !== (user?.username||'') , [token, username, user?.username]);

  // Compute stats from blockchain data when using Web3 mode
  const myRequests = useMemo(()=> walletAddr ? requests.filter(r=> r.requester.toLowerCase() === walletAddr.toLowerCase()) : [], [walletAddr, requests]);
  const pending = myRequests.filter(r=> r.status === 1);
  const approved = myRequests.filter(r=> r.status === 2);
  const rejected = myRequests.filter(r=> r.status === 3);
  const myTrees = useMemo(()=> walletAddr ? trees.filter(t=> t.owner.toLowerCase() === walletAddr.toLowerCase()) : [], [walletAddr, trees]);

  // Load from Backend API (MongoDB cache) - SUPPLEMENTARY method for stats only
  const loadStatsFromBackend = useCallback(async () => {
    if (!token) return;
    try {
      // Load profile stats from backend (cached data)
      const profileRes = await fetch(`${API}/api/profile/me`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setStats(profileData.stats || { treesApproved: 0, treesPending: 0, treesRejected: 0, totalCCT: 0 });
      }

      // Load approved trees from backend (only approved ones are in DB)
      const treesRes = await fetch(`${API}/api/profile/trees?status=approved`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (treesRes.ok) {
        const treesData = await treesRes.json();
        setBackendTrees(treesData.trees || []);
      }
    } catch (err) {
      console.error('[Profile] Backend API error:', err);
    }
  }, [token]);

  // Load from Blockchain via Backend Proxy (cached, no rate limits!)
  const loadFromBlockchain = useCallback(async (addr?: string, fresh = false)=>{
    setLoadingOnchain(true);
    setModulesError(null);
    try {
      // Fetch from backend proxy (which caches blockchain data)
      const freshParam = fresh ? '?fresh=true' : '';
      const [treesRes, requestsRes] = await Promise.all([
        fetch(`${API}/api/blockchain/trees${freshParam}`, { credentials: 'include' }),
        fetch(`${API}/api/blockchain/requests${freshParam}`, { credentials: 'include' })
      ]);

      if (treesRes.ok && requestsRes.ok) {
        const treesData = await treesRes.json();
        const requestsData = await requestsRes.json();
        
        setTrees(treesData.trees || []);
        setRequests(requestsData.requests || []);
        setStatusMsg(treesData.cached ? '✓ Loaded (cached)' : '✓ Loaded from blockchain');
      } else {
        throw new Error('Failed to fetch blockchain data from backend');
      }
      
      if (addr) setWalletAddr(addr);
    } catch (error: any) {
      console.error('[Profile] Blockchain load error:', error);
      setModulesError(error.message || 'Failed to load blockchain data');
      setStatusMsg('⚠ Unable to load data - please try again');
    } finally { 
      setLoadingOnchain(false); 
    }
  }, []);

  // On mount: ALWAYS load from blockchain (source of truth), supplement with backend stats
  useEffect(() => { 
    if (token) {
      // Load blockchain data first (this shows all requests)
      loadFromBlockchain();
      // Then load backend stats as supplementary info
      loadStatsFromBackend();
    }
  }, [token, loadFromBlockchain, loadStatsFromBackend]);

  if(!token){
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4">Profile</h1>
        <p>Please <Link className="underline" href="/auth/login">login</Link> to view your profile.</p>
      </div>
    );
  }

  async function onSave(){
    if(!token) return;
    try {
      setSaving(true); setStatusMsg(null);
      await updateCurrentUser(token, { username });
      setStatusMsg('Saved');
      await refresh();
    } catch(e:any){ setStatusMsg(e?.message||'Failed'); }
    finally{ setSaving(false); }
  }

  async function onLinkEmail(){
    const email = prompt('Enter email to link');
    if(!email || !token) return;
    try {
      await linkEmailRequest(token, email);
      const code = prompt('Enter the OTP code sent to '+email);
      if(!code) return;
      await linkEmailVerify(token, email, code);
      setStatusMsg('Email linked');
      await refresh();
    } catch(e:any){ alert(e?.message||'Failed to link email'); }
  }

  async function onLinkGoogle(){
    if(!token) return;
    const url = linkGoogleInitUrl(token);
    window.location.href = url; // after callback, we expect redirect to /auth/link-success
  }

  async function onLinkWallet(){
    if(!token) return;
    try {
      const provider = await connectPetra();
      setWalletAddr(provider.address);
      const challenge = await fetchWalletChallenge();
      const message = challenge?.message || `Miko Auth :: ${Date.now().toString(36)}`;
      const { signature, full } = await signMessagePetra(message);
      await linkWallet(token, { address: provider.address, publicKey: (full?.publicKeyHex||full?.publicKey || full?.publicKeyBytes), network:'aptos' });
      setStatusMsg('Wallet linked');
      await refresh();
    } catch(e:any){ alert(e?.message||'Failed to link Petra'); }
  }

  // lightweight helper to connect wallet for viewing (without linking)
  const connectWallet = useCallback(async ()=>{
    try {
      const p = await connectPetra();
      setWalletAddr(p.address);
      await loadFromBlockchain(p.address);
    } catch(e:any){ setStatusMsg(e?.message||'Unable to connect wallet'); }
  }, [loadFromBlockchain]);
  
  // If user already has a linked wallet (via auth methods), auto-use it
  useEffect(()=>{
    const linked = methods?.wallets?.[0]?.address;
    if (linked && !walletAddr) {
      setWalletAddr(linked);
    }
  }, [methods?.wallets, walletAddr]);

  // If Petra is already connected in the browser, adopt its address without prompting
  useEffect(()=>{
    try {
      if (typeof window === 'undefined' || walletAddr) return;
      const anyWin: any = window as any;
      const addr: string | undefined = anyWin?.petra?.address || anyWin?.aptos?.account?.address;
      if (addr && typeof addr === 'string') {
        setWalletAddr(addr);
      }
    } catch {}
  }, [walletAddr]);

  async function onDelete(){
    if(!token) return;
    if(!confirm('This will permanently delete your account. Continue?')) return;
    try {
      await deleteAccount(token);
      await logout();
      window.location.href = '/';
    } catch(e:any){ alert(e?.message||'Failed to delete account'); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      {statusMsg ? <div className="mb-4 text-sm text-emerald-400">{statusMsg}</div> : null}
      {modulesError ? (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/30 p-3 text-sm text-yellow-200">
          {modulesError} — stats may be empty. If you just deployed, click Refresh.
        </div>
      ) : null}

      {/* Dashboard section */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          {walletAddr ? (
            <div className="flex items-center gap-3">
              <button 
                className="btn-secondary" 
                onClick={async ()=> { 
                  // Force fresh data from blockchain (bypass cache)
                  await loadFromBlockchain(walletAddr, true);
                  await loadStatsFromBackend();
                }} 
                disabled={loadingOnchain || loadingBackend}
              >
                {loadingOnchain ? 'Loading...' : 'Refresh'}
              </button>
              <div className="text-xs text-neutral-400 break-all">{walletAddr}</div>
            </div>
          ) : (
            <button className="btn-primary" onClick={()=> void connectWallet()}>Connect Wallet to Load</button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pending" value={pending.length} />
          <StatCard label="Approved" value={approved.length} />
          <StatCard label="Rejected" value={rejected.length} />
          <StatCard label="My Trees" value={myTrees.length} />
        </div>
        <div className="mt-4 flex gap-3">
          <Link href="/marketplace" className="btn-secondary">Go to Marketplace</Link>
          <button className="btn-primary" onClick={()=> setSellOpen(true)} disabled={!walletAddr}>Sell CCT</button>
        </div>
      </section>

      <section className="mb-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-3">Account</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Username</span>
            <input id="username" name="username" value={username} onChange={e=>setUsername(e.target.value)} className="px-3 py-2 rounded-md bg-neutral-800 border border-neutral-700 outline-none focus:ring-2 focus:ring-emerald-500/40" placeholder="yourname" />
          </label>
          <div className="flex items-end">
            <button onClick={onSave} disabled={!canSave || saving} className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">Save</button>
          </div>
        </div>
        <div className="mt-3 text-sm text-neutral-400">Role: {user?.role}</div>
      </section>

      <section className="mb-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-3">Linked methods</h2>
        <div className="flex flex-wrap gap-2">
          <Badge active={!!methods?.google}>Google</Badge>
          <Badge active={!!methods?.passwordless}>Email OTP</Badge>
          <Badge active={(methods?.wallets?.length||0)>0}>Wallet</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={onLinkGoogle} className="nav-btn">Link Google</button>
          <button onClick={onLinkEmail} className="nav-btn">Link Email</button>
          <button onClick={onLinkWallet} className="nav-btn">Link Petra Wallet</button>
        </div>
      </section>

      {/* Requests sections */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Pending Requests</h2>
        <CardsGrid emptyText={walletAddr? 'No pending requests' : 'Connect wallet to view'}>
          {pending.map(r => (
            <RequestCard key={r.id} r={r} />
          ))}
        </CardsGrid>
      </section>

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Approved</h2>
        <CardsGrid emptyText={walletAddr? 'No approved requests yet' : 'Connect wallet to view'}>
          {approved.map(r => (
            <RequestCard key={r.id} r={r} approved />
          ))}
        </CardsGrid>
      </section>

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Rejected</h2>
        <CardsGrid emptyText={walletAddr? 'No rejected requests' : 'Connect wallet to view'}>
          {rejected.map(r => (
            <RequestCard key={r.id} r={r} rejected />
          ))}
        </CardsGrid>
      </section>

      <section className="mb-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
        <h2 className="text-lg font-semibold mb-3">Preferences</h2>
        <ThemeToggle variant="square" />
      </section>

      <section className="p-4 rounded-xl border border-red-900 bg-red-950/30">
        <h2 className="text-lg font-semibold mb-3 text-red-300">Danger zone</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={()=>{ void logout(); }} className="px-4 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700">Sign out</button>
          <button onClick={onDelete} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500">Delete account</button>
        </div>
      </section>
      {/* Sell modal */}
      {sellOpen && (
        <SellModal
          onClose={()=> setSellOpen(false)}
          onSubmit={async (amount, price)=>{
            setSellSubmitting(true);
            try {
              const provider: any = (window as any).petra || (window as any).aptos;
              if (!provider?.signAndSubmitTransaction) throw new Error('Petra wallet not available');
              const payload: any = {
                type: 'entry_function_payload',
                function: `${MODULE_ADDRESS}::marketplace::list`,
                type_arguments: [],
                arguments: [String(amount), String(price)],
              };
              const now = Math.floor(Date.now() / 1000);
              const opts: any = {
                maxGasAmount: '200000',
                gasUnitPrice: '100',
                expirationTimestampSecs: String(now + 600),
                estimateGasUnitPrice: false,
                estimateMaxGasAmount: false,
                estimatePrioritizedGasUnitPrice: false,
              };
              await provider.signAndSubmitTransaction(payload, opts);
              setSellOpen(false);
            } catch(e:any){ alert(e?.message || 'Failed to list tokens'); }
            finally { setSellSubmitting(false); }
          }}
          submitting={sellSubmitting}
          amount={sellAmount}
          price={sellPrice}
          setAmount={setSellAmount}
          setPrice={setSellPrice}
        />
      )}

    </div>
  );
}

function Badge({ active, children }:{ active:boolean; children:React.ReactNode }){
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active? 'bg-emerald-600 text-neutral-900':'bg-neutral-800 text-neutral-400'}`}>{children}</span>
  );
}

function StatCard({ label, value }:{ label:string; value:number|string }){
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function CardsGrid({ children, emptyText }:{ children: React.ReactNode; emptyText?: string }){
  const has = Array.isArray(children) ? (children as any[]).length>0 : !!children;
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {has ? children : (
        <div className="col-span-full text-neutral-400 text-sm">{emptyText || 'Nothing to show'}</div>
      )}
    </div>
  );
}

function RequestCard({ r, approved, rejected }:{ r: Request; approved?: boolean; rejected?: boolean }){
  const when = new Date(r.submitted_at * 1000).toLocaleString();
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 flex flex-col gap-2">
      <div className="text-sm text-neutral-400">Request #{r.id}</div>
      <div className="text-sm truncate text-neutral-300">{r.metadata_uri || 'no metadata'}</div>
      <div className="text-xs text-neutral-500">Submitted {when}</div>
      <div className="mt-1">
        <span className={`px-2 py-0.5 rounded-full text-xs ${approved? 'bg-emerald-500/20 text-emerald-300' : rejected ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
          {approved? 'Approved' : rejected? 'Rejected' : 'Pending'}
        </span>
      </div>
      {approved && (
        <Link href="/marketplace" className="mt-2 btn-secondary">Sell CCT</Link>
      )}
    </div>
  );
}

function SellModal({ onClose, onSubmit, submitting, amount, price, setAmount, setPrice }:{ onClose:()=>void; onSubmit:(amount:number, price:number)=>Promise<void>; submitting:boolean; amount:number; price:number; setAmount:(n:number)=>void; setPrice:(n:number)=>void; }){
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface-glass)] p-5">
        <h3 className="text-lg font-semibold mb-3">List CCT on Marketplace</h3>
        <div className="grid gap-3">
          <label className="text-sm" htmlFor="sell-amount">Amount
            <input id="sell-amount" name="amount" type="number" value={amount} onChange={e=> setAmount(Number(e.target.value)||0)} className="mt-1 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2" />
          </label>
          <label className="text-sm" htmlFor="sell-price">Unit price
            <input id="sell-price" name="price" type="number" value={price} onChange={e=> setPrice(Number(e.target.value)||0)} className="mt-1 w-full rounded-md bg-black/30 border border-white/10 px-3 py-2" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn-primary" onClick={()=> onSubmit(amount, price)} disabled={submitting || amount<=0 || price<=0}>List</button>
        </div>
      </div>
    </div>
  );
}
