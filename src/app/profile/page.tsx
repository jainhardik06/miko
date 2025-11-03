"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../components/auth/AuthProvider';
import { fetchWalletChallenge, linkEmailRequest, linkEmailVerify, linkWallet, linkGoogleInitUrl, updateCurrentUser, deleteAccount } from '../../lib/authClient';
import { connectPetra, signMessagePetra } from '../../lib/petra';
import ThemeToggle from '../../components/ThemeToggle';
import { MODULE_ADDRESS, getConfig } from '../../config';
import type { Tree, Request } from '../../lib/aptos';
import { getCCTBalance, ratePpmToTokens, microToTokens, getPendingCCT, buildClaimPendingTx, fetchListings, tokensToMicro } from '../../lib/aptos';
import { aptos as aptosClient } from '../../state/store';
import React from 'react';

const API = getConfig().apiOrigin;

const formatTokens = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString();
};

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
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [cctBalance, setCctBalance] = useState<number>(0);
  const [pendingCct, setPendingCct] = useState<number>(0);
  const [claimingPending, setClaimingPending] = useState(false);
  const [pendingClaimAttempted, setPendingClaimAttempted] = useState(false);
  const [listedCct, setListedCct] = useState<number>(0);
  
  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<Request | null>(null);
  const [detailsMetadata, setDetailsMetadata] = useState<any>(null);

  useEffect(()=>{ setUsername(user?.username || ''); }, [user?.username]);

  const canSave = useMemo(()=> token && username && username !== (user?.username||'') , [token, username, user?.username]);

  // Compute stats from blockchain data when using Web3 mode
  const myRequests = useMemo(()=> walletAddr ? requests.filter(r=> r.requester.toLowerCase() === walletAddr.toLowerCase()) : [], [walletAddr, requests]);
  const pending = myRequests.filter(r=> r.status === 1);
  const approved = myRequests.filter(r=> r.status === 2);
  const rejected = myRequests.filter(r=> r.status === 3);
  const myTrees = useMemo(()=> walletAddr ? trees.filter(t=> t.owner.toLowerCase() === walletAddr.toLowerCase()) : [], [walletAddr, trees]);
  
  // Calculate total CCT granted from all approved requests
  const totalCCTGranted = useMemo(() => {
  return approved.reduce((sum, req) => sum + (req.granted_cct ?? ratePpmToTokens(req.rate_ppm)), 0);
  }, [approved]);

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
  const refreshListedTokens = useCallback(async (addressOverride?: string) => {
    try {
      const target = (addressOverride || walletAddr)?.toLowerCase();
      if (!target) {
        setListedCct(0);
        return;
      }

      const listings = await fetchListings();
      const totalMicro = listings
        .filter(l => l.seller.toLowerCase() === target)
        .reduce((sum, l) => sum + l.remaining_micro, 0);
      setListedCct(microToTokens(totalMicro));
    } catch (error) {
      console.error('[Profile] Failed to load marketplace listings:', error);
    }
  }, [walletAddr]);

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
      
      if (addr) {
        setWalletAddr(addr);
        await refreshListedTokens(addr);
      } else {
        await refreshListedTokens();
      }
    } catch (error: any) {
      console.error('[Profile] Blockchain load error:', error);
      setModulesError(error.message || 'Failed to load blockchain data');
      setStatusMsg('⚠ Unable to load data - please try again');
    } finally { 
      setLoadingOnchain(false); 
    }
  }, [refreshListedTokens]);

  // On mount: ALWAYS load from blockchain (source of truth), supplement with backend stats
  useEffect(() => { 
    if (token) {
      // Load blockchain data first (this shows all requests)
      loadFromBlockchain();
      // Then load backend stats as supplementary info
      loadStatsFromBackend();
    }
  }, [token, loadFromBlockchain, loadStatsFromBackend]);

  useEffect(() => { void refreshListedTokens(); }, [walletAddr, refreshListedTokens]);

  const attemptClaimPending = useCallback(async (address: string) => {
    if (claimingPending) return false;
    try {
      const provider: any = typeof window !== 'undefined' ? ((window as any).petra || (window as any).aptos) : null;
      if (!provider) return false;
      const tx = await buildClaimPendingTx(address);
      if (!tx) return false;
      setClaimingPending(true);
      const result = await provider.signAndSubmitTransaction(tx);
      if (result?.hash) {
        await aptosClient.waitForTransaction({ transactionHash: result.hash });
      }
      return true;
    } catch (error) {
      console.error('Failed to claim pending CCT:', error);
      return false;
    } finally {
      setClaimingPending(false);
    }
  }, [claimingPending]);

  // Fetch CCT balance when wallet or trees change
  useEffect(() => {
    const fetchBalance = async () => {
      if (!walletAddr) return;
      
      try {
        // Fetch current wallet balance
  const balance = await getCCTBalance(walletAddr);
  setCctBalance(balance);
  console.log('[Profile] Fetched CCT balance:', microToTokens(balance), 'CCT');

        const pending = await getPendingCCT(walletAddr);
        setPendingCct(pending);

        if (pending > 0 && !pendingClaimAttempted) {
          setPendingClaimAttempted(true);
          const claimed = await attemptClaimPending(walletAddr);
          if (claimed) {
            const refreshedBalance = await getCCTBalance(walletAddr);
            setCctBalance(refreshedBalance);
            const freshPending = await getPendingCCT(walletAddr);
            setPendingCct(freshPending);
            if (freshPending === 0) {
              setPendingClaimAttempted(false);
            }
          }
        } else if (pending === 0 && pendingClaimAttempted) {
          setPendingClaimAttempted(false);
        }
      } catch (e) {
        console.error('Failed to fetch balance:', e);
      }
    };
    
    fetchBalance();
  }, [walletAddr, myTrees, attemptClaimPending, pendingClaimAttempted]);

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

  async function onDelete(){
    if(!token) return;
    if(!confirm('This will permanently delete your account. Continue?')) return;
    try {
      await deleteAccount(token);
      await logout();
      window.location.href = '/';
    } catch(e:any){ alert(e?.message||'Failed to delete account'); }
  }
  
  const handleShowDetails = async (request: Request) => {
    setDetailsRequest(request);
    setShowDetailsModal(true);
    
    // Fetch metadata
    if (request.metadata_uri) {
      try {
        let fetchUrl = request.metadata_uri;
        if (fetchUrl.startsWith('ipfs://')) {
          const cid = fetchUrl.replace('ipfs://', '');
          fetchUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        }
        const resp = await fetch(fetchUrl);
        if (resp.ok) {
          const meta = await resp.json();
          setDetailsMetadata(meta);
        }
      } catch (e) {
        console.error('Failed to fetch metadata:', e);
        setDetailsMetadata(null);
      }
    }
  };

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
  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Pending" value={pending.length} />
          <StatCard label="Approved" value={approved.length} />
          <StatCard label="Rejected" value={rejected.length} />
          <StatCard label="Total CCT Granted" value={formatTokens(totalCCTGranted)} />
          <StatCard label="Listed (Escrowed)" value={formatTokens(listedCct)} />
        </div>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link href="/marketplace" className="btn-secondary">Go to Marketplace</Link>
          <button 
            className="btn-primary" 
            onClick={async () => {
              if (!walletAddr) return;
              // Fetch CCT balance and set max amount
              try {
                const balance = await getCCTBalance(walletAddr);
                console.log('Fetched CCT balance:', microToTokens(balance));
                
                // Set all states before opening modal
                setCctBalance(balance);
                setSellAmount(microToTokens(balance));
                
                // Small delay to ensure state updates
                setTimeout(() => {
                  setSellOpen(true);
                }, 100);
              } catch (e) {
                console.error('Failed to fetch CCT balance:', e);
                alert('Failed to fetch your CCT balance');
              }
            }} 
            disabled={!walletAddr}
          >
            Sell CCT
          </button>
        </div>
        {pendingCct > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span>
              ⚠️ We detected {formatTokens(microToTokens(pendingCct))} CCT pending for your wallet. We’ll try to register and claim it automatically—if your wallet prompts for a transaction, please approve to complete the claim.
            </span>
            <button
              className="self-start rounded-md border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
              onClick={async () => {
                if (!walletAddr) return;
                const claimed = await attemptClaimPending(walletAddr);
                if (claimed) {
                  const refreshedBalance = await getCCTBalance(walletAddr);
                  setCctBalance(refreshedBalance);
                  const freshPending = await getPendingCCT(walletAddr);
                  setPendingCct(freshPending);
                  if (freshPending === 0) {
                    setPendingClaimAttempted(false);
                  }
                }
              }}
              disabled={claimingPending}
            >
              {claimingPending ? 'Claiming…' : 'Claim now'}
            </button>
          </div>
        ) : null}
        
        {/* Info about selling */}
        <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200">
          ℹ️ <strong>How it works:</strong> When your tree request is approved, you receive CCT tokens (shown in &ldquo;Total CCT Granted&rdquo;). You can list these tokens on the marketplace at ₹500 per token. Buyers pay in rupees and receive the CCT tokens.
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
            <RequestCard key={r.id} r={r} onDetailsClick={() => handleShowDetails(r)} />
          ))}
        </CardsGrid>
      </section>

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Approved</h2>
        <CardsGrid emptyText={walletAddr? 'No approved requests yet' : 'Connect wallet to view'}>
          {approved.map(r => (
            <RequestCard 
              key={r.id} 
              r={r} 
              approved 
              onDetailsClick={() => handleShowDetails(r)}
            />
          ))}
        </CardsGrid>
      </section>

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Rejected</h2>
        <CardsGrid emptyText={walletAddr? 'No rejected requests' : 'Connect wallet to view'}>
          {rejected.map(r => (
            <RequestCard key={r.id} r={r} rejected onDetailsClick={() => handleShowDetails(r)} />
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
          onClose={()=> {
            setSellOpen(false);
            setSelectedRequest(null);
            setSellAmount(0);
          }}
          onSubmit={async (amount)=>{
            setSellSubmitting(true);
            try {
              const FIXED_PRICE_RS = 500; // Fixed price in Rupees per token
              const provider: any = (window as any).petra || (window as any).aptos;
              if (!provider?.signAndSubmitTransaction) throw new Error('Petra wallet not available');
              if (!Number.isInteger(amount)) {
                throw new Error('Amount must be a whole number');
              }
              const microAmount = tokensToMicro(amount);
              if (microAmount <= 0) throw new Error('Amount must be greater than zero');
              if (typeof cctBalance === 'number' && microAmount > cctBalance) {
                throw new Error('Amount exceeds wallet balance');
              }
              const payload: any = {
                type: 'entry_function_payload',
                function: `${MODULE_ADDRESS}::marketplace::list`,
                type_arguments: [],
                arguments: [String(microAmount), String(FIXED_PRICE_RS)],
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
              const result = await provider.signAndSubmitTransaction(payload, opts);
              console.log('Listed CCT on marketplace:', result);
              if (result?.hash) {
                await aptosClient.waitForTransaction({ transactionHash: result.hash });
              }
              const latestBalance = walletAddr ? await getCCTBalance(walletAddr) : null;
              if (latestBalance !== null && latestBalance !== undefined) {
                setCctBalance(latestBalance);
              }
              alert(`Successfully listed ${amount} CCT at ₹${FIXED_PRICE_RS} per token (Total: ₹${(amount * FIXED_PRICE_RS).toLocaleString()})!`);
              await refreshListedTokens(walletAddr || undefined);
              await loadFromBlockchain(walletAddr || undefined, true);
              setSellAmount(0);
              setSellOpen(false);
              setSelectedRequest(null);
            } catch(e:any){ 
              console.error('Failed to list tokens:', e);
              alert(e?.message || 'Failed to list tokens'); 
            }
            finally { setSellSubmitting(false); }
          }}
          submitting={sellSubmitting}
          amount={sellAmount}
          setAmount={setSellAmount}
          balance={cctBalance}
        />
      )}
      
      {/* Details modal */}
      {showDetailsModal && detailsRequest && (
        <DetailsModal 
          request={detailsRequest}
          metadata={detailsMetadata}
          onClose={() => {
            setShowDetailsModal(false);
            setDetailsRequest(null);
            setDetailsMetadata(null);
          }}
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

function RequestCard({ r, approved, rejected, onDetailsClick }:{ r: Request; approved?: boolean; rejected?: boolean; onDetailsClick?: () => void }){
  const when = new Date(r.submitted_at * 1000).toLocaleString();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [metadata, setMetadata] = React.useState<any>(null);
  
  // Fetch metadata from IPFS if available
  React.useEffect(() => {
    if (!r.metadata_uri) return;
    
    const fetchMetadata = async () => {
      try {
        let fetchUrl = r.metadata_uri;
        
        // Convert IPFS URI to gateway URL
        if (fetchUrl.startsWith('ipfs://')) {
          const cid = fetchUrl.replace('ipfs://', '');
          fetchUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        }
        
        const resp = await fetch(fetchUrl);
        if (resp.ok) {
          const meta = await resp.json();
          setMetadata(meta);
          
          // Extract image URL
          if (meta.image) {
            let imgUrl = meta.image;
            if (imgUrl.startsWith('ipfs://')) {
              const imgCid = imgUrl.replace('ipfs://', '');
              imgUrl = `https://gateway.pinata.cloud/ipfs/${imgCid}`;
            }
            setImageUrl(imgUrl);
          }
        }
      } catch (e) {
        console.error('Failed to fetch metadata:', e);
      }
    };
    
    fetchMetadata();
  }, [r.metadata_uri]);
  
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden flex flex-col">
      {imageUrl && (
        <div className="w-full h-40 bg-neutral-800 relative">
          <img 
            src={imageUrl} 
            alt={`Request ${r.id}`} 
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2">
        <div className="text-sm text-neutral-400">Request #{r.id}</div>
        {metadata?.attributes?.name && (
          <div className="font-medium text-base">{metadata.attributes?.name}</div>
        )}
        {metadata?.attributes?.speciesCommon && (
          <div className="text-sm text-neutral-300">🌳 {metadata.attributes?.speciesCommon}</div>
        )}
        {metadata?.verificationData?.aiVerified && (
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <span>✓</span> AI Verified ({Math.round((metadata?.verificationData?.confidence ?? 0) * 100)}% confidence)
          </div>
        )}
        {approved && r.rate_ppm > 0 && (
          <div className="text-sm font-medium text-emerald-300 flex items-center gap-1">
            <span>💰</span> {formatTokens(r.granted_cct ?? ratePpmToTokens(r.rate_ppm))} CCT Granted
          </div>
        )}
        <div className="text-xs text-neutral-500">Submitted {when}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs ${approved? 'bg-emerald-500/20 text-emerald-300' : rejected ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
            {approved? 'Approved' : rejected? 'Rejected' : 'Pending'}
          </span>
        </div>
        {onDetailsClick && (
          <button onClick={onDetailsClick} className="mt-2 btn-secondary w-full">View Details</button>
        )}
      </div>
    </div>
  );
}

function SellModal({ onClose, onSubmit, submitting, amount, setAmount, balance }:{ onClose:()=>void; onSubmit:(amount:number)=>Promise<void>; submitting:boolean; amount:number; setAmount:(n:number)=>void; balance?: number }){
  const FIXED_PRICE_RS = 500; // Fixed price per token in Rupees
  const totalPrice = amount * FIXED_PRICE_RS;
  const walletTokens = typeof balance === 'number' ? microToTokens(balance) : 0;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface-glass)] p-6">
        <h3 className="text-xl font-semibold mb-4">Sell CCT Tokens</h3>
        
        {/* Balance Display */}
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-sm text-emerald-300 mb-1">💰 Your Wallet CCT Balance</div>
          <div className="text-2xl font-bold text-emerald-300">{formatTokens(walletTokens)} CCT</div>
          {walletTokens === 0 && (
            <div className="text-xs text-yellow-300 mt-2">
              ⚠️ Approved trees mint CCT straight to your wallet. If you still see 0 CCT, the approval may not be complete yet or your wallet might not be registered for CCT.
            </div>
          )}
        </div>
        
        {/* Amount Input */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block" htmlFor="sell-amount">
            Number of Tokens to Sell
          </label>
          <div className="relative">
            <input 
              id="sell-amount" 
              name="amount" 
              type="number" 
              value={amount} 
              onChange={e=> {
                const next = Math.max(0, Math.floor(Number(e.target.value) || 0));
                setAmount(Math.min(next, walletTokens));
              }}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-4 py-3 pr-20 text-lg font-medium" 
              placeholder="0"
              min={0}
              step={1}
              max={walletTokens}
            />
            <button
              type="button"
              onClick={() => setAmount(walletTokens)}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
            >
              MAX
            </button>
          </div>
          <div className="text-xs text-neutral-400 mt-1">Maximum: {formatTokens(walletTokens)} CCT</div>
        </div>
        
        {/* Price Info */}
        <div className="mb-4 p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-400">Price per Token:</span>
            <span className="text-base font-semibold">₹{FIXED_PRICE_RS}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-400">Total Value:</span>
            <span className="text-xl font-bold text-emerald-300">₹{totalPrice.toLocaleString()}</span>
          </div>
        </div>
        
        {/* Warning */}
        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="text-xs text-yellow-300">
            ⚠️ Your tokens will be escrowed in the marketplace contract until sold. Only gas fees will be charged for this transaction.
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button 
            className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-neutral-800 hover:bg-neutral-700 font-medium transition-colors" 
            onClick={onClose} 
            disabled={submitting}
          >
            Cancel
          </button>
          <button 
            className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={()=> onSubmit(amount)} 
            disabled={submitting || amount<=0 || (walletTokens > 0 && amount > walletTokens) || !Number.isInteger(amount)}
          >
            {submitting ? 'Listing...' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsModal({ request, metadata, onClose }: { request: Request; metadata: any; onClose: () => void }) {
  const statusText = request.status === 1 ? 'Pending' : request.status === 2 ? 'Approved' : 'Rejected';
  const statusColor = request.status === 1 ? 'yellow' : request.status === 2 ? 'emerald' : 'red';
  const submittedDate = new Date(request.submitted_at * 1000).toLocaleString();
  
  // Convert image URL if IPFS
  let imageUrl = metadata?.image;
  if (imageUrl?.startsWith('ipfs://')) {
    const imgCid = imageUrl.replace('ipfs://', '');
    imageUrl = `https://gateway.pinata.cloud/ipfs/${imgCid}`;
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--surface-glass)] p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-semibold">Request Details</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        {/* Image */}
        {imageUrl && (
          <div className="mb-4 rounded-lg overflow-hidden bg-neutral-800">
            <img src={imageUrl} alt={`Request ${request.id}`} className="w-full h-64 object-cover" />
          </div>
        )}
        
        {/* Basic Info */}
        <div className="grid gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">Request ID:</span>
            <span className="font-medium">#{request.id}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm bg-${statusColor}-500/20 text-${statusColor}-300`}>
              {statusText}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-400">Submitted:</span>
            <span className="text-sm">{submittedDate}</span>
          </div>
          
          {request.status === 2 && request.rate_ppm > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-400">CCT Granted:</span>
              <span className="font-medium text-emerald-300">💰 {formatTokens(request.granted_cct ?? ratePpmToTokens(request.rate_ppm))} CCT</span>
            </div>
          )}
        </div>
        
        {/* Metadata Details */}
        {metadata && (
          <div className="border-t border-white/10 pt-4 space-y-4">
            <h4 className="font-semibold text-lg">Tree Information</h4>
            
            {metadata.attributes?.name && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Name:</span>
                <span className="font-medium">{metadata.attributes?.name}</span>
              </div>
            )}
            
            {metadata.attributes?.speciesCommon && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Species:</span>
                <span>🌳 {metadata.attributes?.speciesCommon}</span>
              </div>
            )}
            
            {metadata.attributes?.speciesScientific && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Scientific Name:</span>
                <span className="italic text-neutral-300">{metadata.attributes?.speciesScientific}</span>
              </div>
            )}
            
            {metadata.attributes?.age && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Age:</span>
                <span>{metadata.attributes?.age} years</span>
              </div>
            )}
            
            {metadata.attributes?.heightM && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Height:</span>
                <span>{metadata.attributes?.heightM} meters</span>
              </div>
            )}
            
            {metadata.attributes?.girthCm && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Girth:</span>
                <span>{metadata.attributes?.girthCm} cm</span>
              </div>
            )}
            
            {metadata.location && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Location:</span>
                <span className="text-sm">
                  {metadata.location.lat && metadata.location.lon && (
                    <>Lat: {metadata.location.lat.toFixed(6)}, Lon: {metadata.location.lon.toFixed(6)}</>
                  )}
                </span>
              </div>
            )}
            
            {metadata.heading && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Compass Heading:</span>
                <span className="text-sm">{Math.round(metadata.heading)}°</span>
              </div>
            )}
            
            {/* AI Verification */}
            {metadata.verificationData && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="font-medium text-emerald-300 mb-2 flex items-center gap-2">
                  <span>✓</span> AI Verification
                </div>
                <div className="text-sm space-y-1">
                  <div>Status: {metadata.verificationData.aiVerified ? 'Verified' : 'Not Verified'}</div>
                  {metadata.verificationData.confidence && (
                    <div>Confidence: {Math.round(metadata.verificationData.confidence * 100)}%</div>
                  )}
                  {metadata.verificationData.estimatedCCT && (
                    <div>Estimated CCT: {metadata.verificationData.estimatedCCT}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Diseases */}
            {(metadata.attributes?.diseases?.length ?? 0) > 0 && (
              <div className="mt-4">
                <h5 className="font-medium mb-2">Diseases Detected:</h5>
                <div className="space-y-3">
                  {metadata.attributes?.diseases?.map((disease: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
                      <div className="font-medium text-yellow-300">{disease.name}</div>
                      {disease.appearance && (
                        <div className="text-sm text-neutral-400 mt-1">{disease.appearance}</div>
                      )}
                      {disease.photo && (
                        <div className="mt-2">
                          <img 
                            src={disease.photo.startsWith('ipfs://') 
                              ? `https://gateway.pinata.cloud/ipfs/${disease.photo.replace('ipfs://', '')}`
                              : disease.photo
                            } 
                            alt={disease.name}
                            className="w-32 h-32 object-cover rounded"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {metadata.attributes?.details && (
              <div className="flex items-start gap-3">
                <span className="text-sm text-neutral-400 min-w-[120px]">Additional Details:</span>
                <span className="text-sm text-neutral-300">{metadata.attributes?.details}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Metadata URI */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-neutral-500 break-all">
            <span className="font-medium">Metadata URI: </span>
            {request.metadata_uri}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-primary">Close</button>
        </div>
      </div>
    </div>
  );
}
