"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../components/auth/AuthProvider';
import { fetchWalletChallenge, linkEmailRequest, linkEmailVerify, linkWallet, linkGoogleInitUrl, updateCurrentUser, deleteAccount } from '../../lib/authClient';
import { connectPetra, signMessagePetra } from '../../lib/petra';
import ThemeToggle from '../../components/ThemeToggle';
import { MODULE_ADDRESS, getConfig } from '../../config';
import type { Tree, Request, Listing } from '../../lib/aptos';
import { getCCTBalance, ratePpmToTokens, microToTokens, getPendingCCT, buildClaimPendingTx, fetchListings, tokensToMicro } from '../../lib/aptos';
import { fetchWalletSummary, fetchWalletTransactions, updateBankDetails, createRazorpayWalletTopup, createCryptoWalletTopup } from '../../lib/walletClient';
import { aptos as aptosClient } from '../../state/store';
import React from 'react';

const API = getConfig().apiOrigin;

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const formatINR = (value: number): string => {
  const rupees = Number.isFinite(value) ? value : 0;
  return `₹ ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const paiseToRupees = (paise: number): number => (Number.isFinite(paise) ? paise : 0) / 100;

async function loadRazorpayCheckout(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  if (window.Razorpay) return window.Razorpay;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
  return window.Razorpay || null;
}

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

interface BankDetailsSummary {
  accountHolderName?: string;
  bankName?: string;
  ifscCode?: string;
  accountLast4?: string;
  maskedAccount?: string;
  updatedAt?: string;
}

interface WalletSummaryData {
  balancePaise: number;
  balanceInr: number;
  updatedAt?: string;
  bankDetails?: BankDetailsSummary | null;
  wallets?: { address: string }[];
}

interface WalletTransactionRow {
  id: string;
  direction: 'CREDIT' | 'DEBIT';
  amountPaise: number;
  balanceAfterPaise: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

interface BankDetailsForm {
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
}

interface CryptoTopupInfo {
  topupId: string;
  amountPaise: number;
  quoteInrPerApt: number;
  aptRequired: number;
  depositAddress: string;
  expiresAt?: string;
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
  const [modulesError, setModulesError] = useState<string | null>(null);

  const [sellOpen, setSellOpen] = useState(false);
  const [sellAmount, setSellAmount] = useState<number>(0);
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [cctBalance, setCctBalance] = useState<number>(0);
  const [pendingCct, setPendingCct] = useState<number>(0);
  const [claimingPending, setClaimingPending] = useState(false);
  const [pendingClaimAttempted, setPendingClaimAttempted] = useState(false);
  const [listedCct, setListedCct] = useState<number>(0);
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [removingListingId, setRemovingListingId] = useState<number | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummaryData | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState<number>(1000);
  const [cryptoTopupAmount, setCryptoTopupAmount] = useState<number>(1000);
  const [cryptoTopupInfo, setCryptoTopupInfo] = useState<CryptoTopupInfo | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);

  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<Request | null>(null);
  const [detailsMetadata, setDetailsMetadata] = useState<any>(null);
  const isCorporate = user?.role === 'CORPORATE';
  const isIndividual = user?.role === 'INDIVIDUAL';
  const walletBalanceInr = walletSummary?.balanceInr ?? paiseToRupees(walletSummary?.balancePaise ?? 0);
  const latestWalletTx = walletTransactions.length > 0 ? walletTransactions[0] : null;

  useEffect(()=>{ setUsername(user?.username || ''); }, [user?.username]);

  const canSave = useMemo(()=> token && username && username !== (user?.username||'') , [token, username, user?.username]);

  // Compute stats from blockchain data when using Web3 mode
  const myRequests = useMemo(()=> walletAddr ? requests.filter(r=> r.requester.toLowerCase() === walletAddr.toLowerCase()) : [], [walletAddr, requests]);
  const pending = myRequests.filter(r=> r.status === 1);
  const approved = myRequests.filter(r=> r.status === 2);
  const rejected = myRequests.filter(r=> r.status === 3);
  const myTrees = useMemo(()=> walletAddr ? trees.filter(t=> t.owner.toLowerCase() === walletAddr.toLowerCase()) : [], [walletAddr, trees]);
  const cctBalanceTokens = useMemo(() => microToTokens(cctBalance), [cctBalance]);
  const corporateHoldings = useMemo(() => (isCorporate ? myTrees : []), [isCorporate, myTrees]);

  // Calculate total CCT granted from all approved requests
  const totalCCTGranted = useMemo(() => {
    return approved.reduce((sum, req) => sum + (req.granted_cct ?? ratePpmToTokens(req.rate_ppm)), 0);
  }, [approved]);

  const soldTokens = useMemo(() => {
    if (isCorporate) return 0;
    if (!walletTransactions.length) return 0;
    const SALE_PRICE_PAISE = 500 * 100;
    const totalSalePaise = walletTransactions.reduce((sum, tx) => {
      const isCredit = tx.direction === 'CREDIT';
      const isSaleRef = tx.referenceType === 'MARKETPLACE_SALE';
      const looksLikeSale = typeof tx.description === 'string' && tx.description.toLowerCase().includes('fiat credit for listing');
      if (!isCredit || (!isSaleRef && !looksLikeSale)) return sum;
      return sum + (tx.amountPaise || 0);
    }, 0);
    if (totalSalePaise <= 0) return 0;
    return Math.max(0, Math.floor(totalSalePaise / SALE_PRICE_PAISE));
  }, [isCorporate, walletTransactions]);

  // Load from Backend API (MongoDB cache) - SUPPLEMENTARY method for stats only
  const loadStatsFromBackend = useCallback(async () => {
    if (!token) return;
    try {
      const profileRes = await fetch(`${API}/api/profile/me`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setStats(profileData.stats || { treesApproved: 0, treesPending: 0, treesRejected: 0, totalCCT: 0 });
        setWalletSummary((prev) => ({
          balancePaise: profileData.wallet?.rupeeBalancePaise ?? profileData.rupeeBalancePaise ?? prev?.balancePaise ?? 0,
          balanceInr: profileData.wallet?.rupeeBalanceInr ?? profileData.rupeeBalanceInr ?? paiseToRupees(profileData.wallet?.rupeeBalancePaise ?? profileData.rupeeBalancePaise ?? prev?.balancePaise ?? 0),
          updatedAt: profileData.wallet?.updatedAt ?? profileData.rupeeBalanceUpdatedAt ?? prev?.updatedAt,
          bankDetails: profileData.wallet?.bankDetails ?? profileData.bankDetails ?? prev?.bankDetails ?? null,
          wallets: profileData.wallet?.aptosWallets ?? profileData.wallets ?? prev?.wallets ?? []
        }));
      }

      const treesRes = await fetch(`${API}/api/profile/trees?status=approved`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (treesRes.ok) {
        const treeData = await treesRes.json();
        setBackendTrees(treeData.trees || []);
      }
    } catch (error) {
      console.error('[Profile] Backend stats load failed:', error);
    }
  }, [token]);

  const refreshWalletSummary = useCallback(async () => {
    if (!token) return;
    try {
      setWalletLoading(true);
      setWalletStatus(null);
      const [summaryData, txData] = await Promise.all([
        fetchWalletSummary(token),
        fetchWalletTransactions(token, 20)
      ]);
      setWalletSummary({
        balancePaise: summaryData?.balancePaise ?? 0,
        balanceInr: summaryData?.balanceInr ?? paiseToRupees(summaryData?.balancePaise ?? 0),
        updatedAt: summaryData?.updatedAt,
        bankDetails: summaryData?.bankDetails ?? null,
        wallets: summaryData?.wallets ?? []
      });
      setWalletTransactions(txData?.transactions || []);
    } catch (error: any) {
      console.error('[Profile] Wallet summary load failed:', error);
      setWalletStatus(error?.message || 'Failed to load wallet summary');
    } finally {
      setWalletLoading(false);
    }
  }, [token]);

  // Load from Blockchain via Backend Proxy (cached, no rate limits!)
  const refreshListedTokens = useCallback(async (addressOverride?: string) => {
    try {
      const target = (addressOverride || walletAddr)?.toLowerCase();
      if (!target) {
        setListedCct(0);
        setUserListings([]);
        return;
      }

      const listings = await fetchListings();
      const mine = listings.filter((l) => l.seller.toLowerCase() === target);
      const totalMicro = mine.reduce((sum, l) => sum + l.remaining_micro, 0);
      setListedCct(microToTokens(totalMicro));
      setUserListings(mine);
    } catch (error) {
      console.error('[Profile] Failed to load marketplace listings:', error);
      setUserListings([]);
      setListedCct(0);
    }
  }, [walletAddr]);

  const handleTopupRazorpay = useCallback(async () => {
    if (!token) return;
    if (!Number.isFinite(topupAmount) || topupAmount <= 0) {
      setWalletStatus('Enter a valid top-up amount.');
      return;
    }
    try {
      setWalletLoading(true);
      const order = await createRazorpayWalletTopup(token, topupAmount);
      const RazorpayCtor = await loadRazorpayCheckout();
      if (!RazorpayCtor) {
        throw new Error('Unable to load Razorpay checkout.');
      }
      const checkout = new RazorpayCtor({
        key: order.key,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Miko Wallet Top-up',
        description: 'Add funds to your custodial balance',
        order_id: order.orderId,
        handler: () => {
          setWalletStatus('Payment initiated. Balance will update after confirmation.');
          void refreshWalletSummary();
        },
        prefill: {
          email: user?.email || undefined,
          name: user?.username || undefined
        },
        theme: { color: '#22c55e' }
      });
      checkout.open();
    } catch (error: any) {
      console.error('[Profile] Razorpay top-up error:', error);
      setWalletStatus(error?.message || 'Failed to start Razorpay checkout');
    } finally {
      setWalletLoading(false);
    }
  }, [token, topupAmount, refreshWalletSummary, user?.email, user?.username]);

  const handleCryptoTopup = useCallback(async () => {
    if (!token) return;
    if (!Number.isFinite(cryptoTopupAmount) || cryptoTopupAmount <= 0) {
      setWalletStatus('Enter a valid top-up amount.');
      return;
    }
    try {
      setWalletLoading(true);
      const intent = await createCryptoWalletTopup(token, cryptoTopupAmount);
      setCryptoTopupInfo(intent);
      setWalletStatus(`Send ${intent.aptRequired} APT to ${intent.depositAddress} before ${intent.expiresAt ? new Date(intent.expiresAt).toLocaleString() : 'expiry'} to complete the top-up.`);
    } catch (error: any) {
      console.error('[Profile] Crypto top-up intent failed:', error);
      setWalletStatus(error?.message || 'Failed to create crypto top-up intent');
    } finally {
      setWalletLoading(false);
    }
  }, [token, cryptoTopupAmount]);

  const handleBankSubmit = useCallback(async (form: BankDetailsForm) => {
    if (!token) return;
    try {
      setBankSubmitting(true);
      await updateBankDetails(token, form);
      setWalletStatus('Bank details updated successfully.');
      setShowBankModal(false);
      await refreshWalletSummary();
    } catch (error: any) {
      console.error('[Profile] Bank update failed:', error);
      setWalletStatus(error?.message || 'Failed to update bank details');
    } finally {
      setBankSubmitting(false);
    }
  }, [token, refreshWalletSummary]);

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

  useEffect(() => {
    if (token) {
      void refreshWalletSummary();
    }
  }, [token, refreshWalletSummary]);

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

  const handleRemoveListing = useCallback(async (listing: Listing) => {
    if (!walletAddr) return;
    const provider: any = typeof window !== 'undefined' ? ((window as any).petra || (window as any).aptos) : null;
    if (!provider?.signAndSubmitTransaction) {
      alert('Petra wallet not available. Please connect your wallet.');
      return;
    }

    setRemovingListingId(listing.id);
    try {
      const payload: any = {
        type: 'entry_function_payload',
        function: `${MODULE_ADDRESS}::marketplace::delist`,
        type_arguments: [],
        arguments: [String(listing.id)],
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
      console.log('Delisting transaction submitted:', result);
      if (result?.hash) {
        await aptosClient.waitForTransaction({ transactionHash: result.hash });
      }

      const latestBalance = await getCCTBalance(walletAddr);
      setCctBalance(latestBalance);
      await refreshListedTokens(walletAddr);
      await loadFromBlockchain(walletAddr, true);
      setListingModalOpen(false);
      setActiveListing(null);
      alert(`Listing #${listing.id} removed. Tokens returned to your wallet.`);
    } catch (error: any) {
      console.error('Failed to remove listing:', error);
      alert(error?.message || 'Failed to remove listing');
    } finally {
      setRemovingListingId(null);
    }
  }, [walletAddr, refreshListedTokens, loadFromBlockchain]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      {statusMsg ? <div className="mb-4 text-sm text-emerald-400">{statusMsg}</div> : null}
      {modulesError ? (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/30 p-3 text-sm text-yellow-200">
          {modulesError} — stats may be empty. If you just deployed, click Refresh.
        </div>
      ) : null}

      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Profile &amp; Payouts</h2>
            <p className="text-sm text-neutral-400">
              {isCorporate
                ? 'Fund your custodial rupee balance to buy carbon credits with fiat rails.'
                : 'Track fiat sales, manage payouts, and keep your bank details current.'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Internal Rupee Balance</div>
            <div className="text-2xl font-semibold">{formatINR(paiseToRupees(walletSummary?.balancePaise || 0))}</div>
            {walletSummary?.updatedAt ? (
              <div className="text-xs text-neutral-500">Updated {new Date(walletSummary.updatedAt).toLocaleString()}</div>
            ) : null}
          </div>
        </div>
        {walletStatus ? (
          <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
            {walletStatus}
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-100">Funding</h3>
              {walletLoading ? <span className="text-xs text-neutral-500">Working…</span> : null}
            </div>
            {isCorporate ? (
              <>
                <div className="mt-3">
                  <label className="text-xs uppercase tracking-wide text-neutral-500">Add funds (Razorpay)</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      min={50}
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(Number(e.target.value))}
                      className="flex-1 rounded-md border border-white/10 bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button className="btn-primary text-sm" onClick={() => void handleTopupRazorpay()} disabled={walletLoading}>
                      Pay with Razorpay
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">UPI, cards, and bank transfers (Razorpay Test Mode).</p>
                </div>
                <div className="mt-4">
                  <label className="text-xs uppercase tracking-wide text-neutral-500">Add funds (Send APT)</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      min={50}
                      value={cryptoTopupAmount}
                      onChange={(e) => setCryptoTopupAmount(Number(e.target.value))}
                      className="flex-1 rounded-md border border-white/10 bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button className="btn-secondary text-sm" onClick={() => void handleCryptoTopup()} disabled={walletLoading}>
                      Generate Deposit
                    </button>
                  </div>
                  {cryptoTopupInfo ? (
                    <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                      <div>Send <strong>{cryptoTopupInfo.aptRequired}</strong> APT to:</div>
                      <code className="mt-1 block break-all text-emerald-200">{cryptoTopupInfo.depositAddress}</code>
                      <div className="mt-1 text-[11px] text-emerald-200/80">
                        Top-up ID: {cryptoTopupInfo.topupId} • Amount: {formatINR(paiseToRupees(cryptoTopupInfo.amountPaise))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Withdrawals arrive in your bank account once sales are settled. Keep your bank details updated to avoid delays.
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-100">Account Details</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase text-neutral-500">Aptos Wallet</div>
                <div className="font-mono text-xs text-neutral-200 break-all">
                  {walletSummary?.wallets?.[0]?.address || methods?.wallets?.[0]?.address || 'Not linked'}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs uppercase text-neutral-500">
                  <span>Bank Details</span>
                  {isIndividual ? (
                    <button className="text-emerald-400 hover:text-emerald-300 text-xs" onClick={() => setShowBankModal(true)}>
                      {walletSummary?.bankDetails ? 'Update' : 'Add'}
                    </button>
                  ) : null}
                </div>
                {walletSummary?.bankDetails ? (
                  <div className="mt-1 text-neutral-300 text-sm">
                    <div>{walletSummary.bankDetails.accountHolderName}</div>
                    <div>
                      {walletSummary.bankDetails.bankName}
                      {' • '}
                      {walletSummary.bankDetails.maskedAccount || (walletSummary.bankDetails.accountLast4 ? `**** **${walletSummary.bankDetails.accountLast4}` : '—')}
                    </div>
                    <div>IFSC: {walletSummary.bankDetails.ifscCode}</div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-neutral-500">
                    {isIndividual ? 'Add bank details to enable fiat payouts.' : 'Payouts are disabled for company accounts.'}
                  </div>
                )}
              </div>
            </div>
            {isIndividual ? (
              <button
                className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-black opacity-60 cursor-not-allowed"
                disabled
              >
                Withdraw to Bank (coming soon)
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-neutral-100">Recent Transactions</h3>
          {walletTransactions.length === 0 ? (
            <div className="text-xs text-neutral-500">No wallet activity yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-neutral-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">When</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {walletTransactions.slice(0, 6).map((tx) => {
                    const amountR = paiseToRupees(tx.amountPaise);
                    const balanceR = paiseToRupees(tx.balanceAfterPaise);
                    return (
                      <tr key={tx.id} className="hover:bg-white/5 text-xs">
                        <td className="px-4 py-2">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2 text-neutral-300">{tx.description || tx.referenceType || '—'}</td>
                        <td className={`px-4 py-2 text-right ${tx.direction === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}{formatINR(amountR)}
                        </td>
                        <td className="px-4 py-2 text-right text-neutral-200">{formatINR(balanceR)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {isCorporate && (
        <>
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Corporate Overview</h2>
              <button
                className="btn-secondary"
                onClick={() => { void refreshWalletSummary(); }}
                disabled={walletLoading}
              >
                {walletLoading ? 'Refreshing…' : 'Refresh balance'}
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Wallet balance</div>
                <div className="mt-2 text-2xl font-semibold text-white">{formatINR(walletBalanceInr)}</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {walletSummary?.updatedAt ? `Updated ${new Date(walletSummary.updatedAt).toLocaleString()}` : 'Balance updates after each purchase'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">CCT tokens held</div>
                <div className="mt-2 text-2xl font-semibold text-white">{formatTokens(cctBalanceTokens)} CCT</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {walletAddr ? `Wallet ${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)} • On-chain snapshot` : 'Link a wallet to view on-chain holdings'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Latest activity</div>
                {latestWalletTx ? (
                  <div className="mt-2 space-y-1 text-sm text-neutral-300">
                    <div className="font-semibold text-white">{latestWalletTx.description || latestWalletTx.referenceType || 'Wallet movement'}</div>
                    <div className={latestWalletTx.direction === 'CREDIT' ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
                      {latestWalletTx.direction === 'CREDIT' ? '+' : '-'}{formatINR(paiseToRupees(latestWalletTx.amountPaise))}
                    </div>
                    <div className="text-[11px] text-neutral-500">{new Date(latestWalletTx.createdAt).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-neutral-400">No wallet movements yet.</div>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Settlement notes</div>
                <p className="mt-2 text-sm text-neutral-300 leading-relaxed">
                  Purchases debit your corporate wallet instantly and credit the seller&apos;s rupee wallet. Token transfers finalise automatically via the marketplace robot.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/marketplace" className="btn-primary">Browse marketplace</Link>
              <Link href="/marketplace-overview" className="btn-secondary">View buying guide</Link>
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Token Lots</h3>
                <p className="text-xs text-neutral-500 mt-1">Every CCT lot currently owned by your corporate wallet.</p>
              </div>
              {walletAddr ? (
                <div className="text-xs text-neutral-500 break-all">Wallet: {walletAddr}</div>
              ) : (
                <button className="btn-secondary" onClick={()=> void connectWallet()}>Link wallet to view</button>
              )}
            </div>
            {walletAddr ? (
              <div className="mt-4">
                <CardsGrid emptyText="No marketplace tokens yet.">
                  {corporateHoldings.map((tree) => (
                    <HoldingCard key={tree.id} tree={tree} />
                  ))}
                </CardsGrid>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Link an Aptos wallet to surface the token lots associated with your corporate account.
              </div>
            )}
          </section>
        </>
      )}

      {!isCorporate && (
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
  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Pending" value={pending.length} />
          <StatCard label="Approved" value={approved.length} />
          <StatCard label="Rejected" value={rejected.length} />
          <StatCard label="Total CCT Granted" value={formatTokens(totalCCTGranted)} />
          <StatCard label="Listed (Escrowed)" value={formatTokens(listedCct)} />
    <StatCard label="Sold to Buyers" value={formatTokens(soldTokens)} />
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
      )}

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

      {!isCorporate && (
        <>
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
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-lg font-semibold">Marketplace Listings</h2>
              <span className="text-xs text-neutral-500">Tokens escrowed: {formatTokens(listedCct)}</span>
            </div>
            {walletAddr ? (
              userListings.length === 0 ? (
                <div className="text-sm text-neutral-400">No active listings in the marketplace.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-neutral-400 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Listing #</th>
                        <th className="px-4 py-3 text-left">Tokens</th>
                        <th className="px-4 py-3 text-left">Unit Price (₹)</th>
                        <th className="px-4 py-3 text-left">Created</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {userListings.map((listing) => (
                        <tr key={listing.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">#{listing.id}</td>
                          <td className="px-4 py-3">{formatTokens(listing.remaining_tokens)}</td>
                          <td className="px-4 py-3">₹ {listing.unit_price}</td>
                          <td className="px-4 py-3 text-xs text-neutral-400">
                            {listing.created_at ? new Date(listing.created_at * 1000).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="btn-secondary text-xs"
                              onClick={() => {
                                setActiveListing(listing);
                                setListingModalOpen(true);
                              }}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="text-sm text-neutral-400">Connect your wallet to view marketplace listings.</div>
            )}
          </section>

          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold mb-4">Rejected</h2>
            <CardsGrid emptyText={walletAddr? 'No rejected requests' : 'Connect wallet to view'}>
              {rejected.map(r => (
                <RequestCard key={r.id} r={r} rejected onDetailsClick={() => handleShowDetails(r)} />
              ))}
            </CardsGrid>
          </section>
        </>
      )}

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

      {listingModalOpen && activeListing && (
        <ListingDetailsModal
          listing={activeListing}
          onClose={() => {
            setListingModalOpen(false);
            setActiveListing(null);
          }}
          onRemove={() => { void handleRemoveListing(activeListing); }}
          removing={removingListingId === activeListing.id}
        />
      )}

      {showBankModal && (
        <BankDetailsModal
          initial={{
            accountHolderName: walletSummary?.bankDetails?.accountHolderName || '',
            bankName: walletSummary?.bankDetails?.bankName || '',
            ifscCode: walletSummary?.bankDetails?.ifscCode || '',
            accountNumber: ''
          }}
          onClose={() => setShowBankModal(false)}
          onSubmit={handleBankSubmit}
          submitting={bankSubmitting}
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

function HoldingCard({ tree }: { tree: Tree }) {
  const mintedAt = tree.created_at ? new Date(tree.created_at * 1000).toLocaleString() : '—';
  const tokens = formatTokens(tree.granted_cct ?? 0);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [metadata, setMetadata] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      if (!tree.metadata_uri) return;
      try {
        let fetchUrl = tree.metadata_uri;
        if (fetchUrl.startsWith('ipfs://')) {
          fetchUrl = `https://gateway.pinata.cloud/ipfs/${fetchUrl.replace('ipfs://', '')}`;
        }
        const resp = await fetch(fetchUrl, { cache: 'reload' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        setMetadata(data);
        const rawImage = data?.image;
        if (typeof rawImage === 'string' && rawImage.length > 0) {
          const resolved = rawImage.startsWith('ipfs://') ? `https://gateway.pinata.cloud/ipfs/${rawImage.replace('ipfs://', '')}` : rawImage;
          setImageUrl(resolved);
        }
      } catch (error) {
        console.error('[Profile] Failed to load holding metadata:', error);
      }
    };
    loadMeta();
    return () => { cancelled = true; };
  }, [tree.metadata_uri]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40">
      {imageUrl && (
        <div className="h-40 w-full bg-neutral-800">
          <img
            src={imageUrl}
            alt={metadata?.attributes?.name || `Tree ${tree.id}`}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-sm text-neutral-400">Lot #{tree.id}</div>
        {metadata?.attributes?.name && (
          <div className="text-base font-semibold text-white">{metadata.attributes.name}</div>
        )}
        {metadata?.attributes?.speciesCommon && (
          <div className="text-sm text-neutral-300">🌳 {metadata.attributes.speciesCommon}</div>
        )}
        <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-emerald-300">Tokens held</span>
          <span className="text-lg font-semibold text-emerald-200">{tokens} CCT</span>
        </div>
        <div className="text-xs text-neutral-500">
          Acquired: {mintedAt}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/asset/${tree.id}`} className="btn-secondary text-xs">View asset</Link>
          {metadata?.attributes?.project && (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-400">{metadata.attributes.project}</span>
          )}
        </div>
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

function CorporatePurchaseModal({
  listing,
  onClose,
  onWallet,
  onRazorpay,
  busy,
  walletBalancePaise,
  aptosWalletAddress,
  error
}: {
  listing: Listing;
  onClose: () => void;
  onWallet: (quantity: number) => void | Promise<void>;
  onRazorpay: (quantity: number) => void | Promise<void>;
  busy: 'wallet' | 'razorpay' | null;
  walletBalancePaise: number;
  aptosWalletAddress: string | null | undefined;
  error: string | null;
}) {
  const [quantity, setQuantity] = React.useState<string>('1');
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setQuantity('1');
    setLocalError(null);
  }, [listing]);

  const maxTokens = Math.max(0, Math.round(listing.remaining_tokens));
  const parsedQty = Number.parseInt(quantity, 10);
  const quantityValid = Number.isInteger(parsedQty) && parsedQty > 0 && parsedQty <= maxTokens;
  const totalPaise = quantityValid ? Math.round(parsedQty * listing.unit_price * 100) : 0;
  const totalInr = paiseToRupees(totalPaise);
  const walletBalanceInr = paiseToRupees(walletBalancePaise);
  const walletSufficient = quantityValid && walletBalancePaise >= totalPaise;
  const disableWallet = busy !== null || !quantityValid || !walletSufficient || !aptosWalletAddress;
  const disableRazorpay = busy !== null || !quantityValid || !aptosWalletAddress;
  const combinedError = localError || error;

  const onQuantityChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    setQuantity(digits);
    setLocalError(null);
  };

  const submitWallet = () => {
    if (!quantityValid) {
      setLocalError('Enter a valid quantity within the listing availability.');
      return;
    }
    onWallet(parsedQty);
  };

  const submitRazorpay = () => {
    if (!quantityValid) {
      setLocalError('Enter a valid quantity within the listing availability.');
      return;
    }
    onRazorpay(parsedQty);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--surface-glass)] p-6">
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-semibold">Buy Tokens</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="mt-2 text-[11px] text-neutral-400 font-mono">
          Listing #{listing.id} • Seller {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Quantity (max {maxTokens})</label>
            <input
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1"
              disabled={busy !== null}
              className="mt-1 w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <div className="mt-1 text-[11px] text-neutral-500">Enter whole tokens only.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-neutral-900/60 p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Unit price</span>
              <span>₹ {listing.unit_price}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-neutral-400">Total</span>
              <span className="text-lg font-semibold text-white">{formatINR(totalInr)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
              <span>Miko wallet balance</span>
              <span className={walletSufficient ? 'text-emerald-300' : 'text-red-300'}>{formatINR(walletBalanceInr)}</span>
            </div>
            {!walletSufficient && quantityValid ? (
              <div className="mt-1 text-[11px] text-red-300">Balance is lower than the purchase total.</div>
            ) : null}
            {aptosWalletAddress ? (
              <div className="mt-2 text-[11px] text-neutral-500">
                Delivery wallet: {aptosWalletAddress.slice(0, 10)}…{aptosWalletAddress.slice(-6)}
              </div>
            ) : null}
          </div>
          {!aptosWalletAddress ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Link an Aptos wallet to continue. Purchases need a delivery address for CCT tokens.
            </div>
          ) : null}
          {combinedError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {combinedError}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={submitWallet}
            disabled={disableWallet}
          >
            {busy === 'wallet' ? 'Processing…' : 'Pay with Wallet'}
          </button>
          <button
            className="flex-1 rounded-md border border-white/10 bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={submitRazorpay}
            disabled={disableRazorpay}
          >
            {busy === 'razorpay' ? 'Opening Razorpay…' : 'Pay with Razorpay'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListingDetailsModal({ listing, onClose, onRemove, removing }:{ listing: Listing; onClose: () => void; onRemove: () => void; removing: boolean }) {
  const created = listing.created_at ? new Date(listing.created_at * 1000).toLocaleString() : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface-glass)] p-6">
        <h3 className="text-xl font-semibold mb-4">Listing #{listing.id}</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-400">Tokens Remaining</span>
            <span className="font-medium text-white">{formatTokens(listing.remaining_tokens)} CCT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Unit Price</span>
            <span className="font-medium text-white">₹ {listing.unit_price}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Created On</span>
            <span className="text-neutral-300">{created}</span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
          Removing this listing will return the escrowed tokens to your wallet. Gas fees apply.
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-neutral-800 hover:bg-neutral-700 transition-colors"
            onClick={onClose}
            disabled={removing}
          >
            Close
          </button>
          <button
            className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onRemove}
            disabled={removing}
          >
            {removing ? 'Removing...' : 'Remove Listing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BankDetailsModal({ initial, onClose, onSubmit, submitting }:{ initial: BankDetailsForm; onClose: () => void; onSubmit: (form: BankDetailsForm) => Promise<void>; submitting: boolean }) {
  const [form, setForm] = React.useState<BankDetailsForm>(initial);
  const [error, setError] = React.useState<string | null>(null);

  const handleChange = (field: keyof BankDetailsForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.accountHolderName || !form.accountNumber || !form.bankName || !form.ifscCode) {
      setError('All fields are required.');
      return;
    }
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err?.message || 'Failed to save bank details');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface-glass)] p-6">
        <h3 className="text-xl font-semibold mb-4">Bank details</h3>
        <p className="text-xs text-neutral-400 mb-4">
          Account numbers are encrypted before storage. Re-enter your full account number whenever you update these details.
        </p>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-neutral-400 text-xs uppercase tracking-wide">Account holder name</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={form.accountHolderName}
              onChange={handleChange('accountHolderName')}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400 text-xs uppercase tracking-wide">Account number</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={form.accountNumber}
              onChange={handleChange('accountNumber')}
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400 text-xs uppercase tracking-wide">Bank name</span>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={form.bankName}
              onChange={handleChange('bankName')}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400 text-xs uppercase tracking-wide">IFSC</span>
            <input
              className="mt-1 w-full uppercase rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={form.ifscCode}
              onChange={handleChange('ifscCode')}
              required
            />
          </label>
        </div>
        {error ? <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div> : null}
        <div className="mt-6 flex gap-3">
          <button type="button" className="flex-1 px-4 py-3 rounded-lg border border-white/10 bg-neutral-800 hover:bg-neutral-700 transition-colors" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="flex-1 px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-medium text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </div>
  );
}
