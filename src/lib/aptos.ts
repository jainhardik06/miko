// Aptos client helpers for Miko PoC
// Provides typed wrappers around Move entry & view functions.
import { aptos } from '../state/store';
import { AccountAddressInput, SimpleTransaction, Aptos, InputViewFunctionData } from '@aptos-labs/ts-sdk';
import { MODULE_ADDRESS } from '../config';

export type Tree = {
  id: number;
  owner: string;
  rate_ppm: number;
  status: number;
  metadata_uri: string;
  cumulative_claimed: number;
  pending?: number;
};

export type Request = {
  id: number;
  requester: string;
  metadata_uri: string;
  submitted_at: number;
  status: number; // 1=pending,2=approved,3=rejected
  rate_ppm: number;
};

// Fallback local cache (populated after first fetch) to avoid redundant view calls in quick succession.
const treeCache = new Map<number, Tree>();

const TREE_MODULE_NAME = 'tree_nft';
const MARKET_MODULE_NAME = 'marketplace';
const REQUESTS_MODULE_NAME = 'tree_requests';

function fq(moduleName: string, func: string): `${string}::${string}::${string}` {
  return `${MODULE_ADDRESS}::${moduleName}::${func}` as `${string}::${string}::${string}`;
}

type ViewPayload = { function: string; functionArguments: unknown[]; typeArguments: string[] };
async function view(aptosClient: Aptos, data: ViewPayload): Promise<unknown[]> {
  // If modules are missing, short-circuit to avoid repeated noisy SDK calls
  if (!(await ensureModulesAvailability())) return [];
  return aptosClient.view({ payload: data as InputViewFunctionData });
}

function getFullnodeBase(): string {
  const net = (process.env.NEXT_PUBLIC_APTOS_NETWORK || 'devnet').toLowerCase();
  if (net.includes('main')) return 'https://fullnode.mainnet.aptoslabs.com';
  if (net.includes('test')) return 'https://fullnode.testnet.aptoslabs.com';
  return 'https://fullnode.devnet.aptoslabs.com';
}

interface RawListing { id: string | number; seller: string; remaining: string | number; unit_price: string | number; created_at: string | number; [k: string]: unknown; }

// Narrow shape for wallet submission result we rely on (hash only)
export interface TxResult { hash: string }

export async function fetchTrees(max: number = 100): Promise<Tree[]> {
  const result: Tree[] = [];
  if (!(await ensureModulesAvailability())) return result;
  for (let id = 0; id < max; id++) {
    // call get_tree which returns Option<Tree>; in TS SDK it will serialize Option as struct or empty
    try {
      const [val] = await view(aptos, {
        function: fq(TREE_MODULE_NAME, 'get_tree'),
        functionArguments: [id],
        typeArguments: []
      });
      if (!val) break; // None encountered
  const tree: Tree = normalizeTree(val as Record<string, unknown>);
      treeCache.set(tree.id, tree);
      result.push(tree);
  } catch {
      // Break on first missing (assumes contiguous ids). Could log for diagnostics.
      break;
    }
  }
  return result;
}

export async function getTree(id: number): Promise<Tree | null> {
  if (!(await ensureModulesAvailability())) return null;
  try {
    const [val] = await view(aptos, {
      function: fq(TREE_MODULE_NAME, 'get_tree'),
      functionArguments: [id],
      typeArguments: []
    });
    if (!val) return null;
  return normalizeTree(val as Record<string, unknown>);
  } catch { return null; }
}

// Iterate request ids [0..max) until the first None is encountered
export async function fetchRequests(max: number = 200): Promise<Request[]> {
  const result: Request[] = [];
  if (!(await ensureModulesAvailability())) return result;
  for (let id = 0; id < max; id++) {
    try {
      const [val] = await view(aptos, {
        function: fq(REQUESTS_MODULE_NAME, 'get_request'),
        functionArguments: [id],
        typeArguments: []
      });
      if (!val) break;
      const r = normalizeRequest(val as Record<string, unknown>);
      result.push(r);
    } catch {
      break;
    }
  }
  return result;
}

// REST fallback: read the Requests resource directly and normalize its entries
export async function fetchRequestsViaRest(): Promise<Request[]> {
  try {
    const base = getFullnodeBase();
    const type = encodeURIComponent(`${MODULE_ADDRESS}::${REQUESTS_MODULE_NAME}::Requests`);
    const url = `${base}/v1/accounts/${MODULE_ADDRESS}/resource/${type}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) return [];
    const json = await resp.json();
    const entries: any[] = json?.data?.entries || [];
    return entries.map((e) => normalizeRequestFromResource(e));
  } catch { return []; }
}

// Build (but do not sign) a claim transaction; wallet adapter will handle gas + signing.
type SimpleEntryFunctionTx = { sender: AccountAddressInput; data: { function: string; functionArguments: unknown[]; typeArguments: string[] } };

export function buildClaimCCTTx(sender: AccountAddressInput, treeId: number): SimpleEntryFunctionTx {
  return {
    sender,
    data: {
      function: fq(TREE_MODULE_NAME, 'claim'),
      functionArguments: [treeId],
      typeArguments: []
    }
  };
}

// Return a wallet-compatible transaction payload for listing tokens.
export function listTokensTx(sender: AccountAddressInput, amount: number, unitPrice: number): SimpleEntryFunctionTx {
  return {
    sender,
    data: {
      function: fq(MARKET_MODULE_NAME, 'list'),
      functionArguments: [amount, unitPrice],
      typeArguments: []
    }
  };
}

export function buyCCT(sender: AccountAddressInput, listingId: number, amount: number): SimpleEntryFunctionTx {
  return {
    sender,
    data: {
      function: fq(MARKET_MODULE_NAME, 'buy'),
      functionArguments: [listingId, amount],
      typeArguments: []
    }
  };
}

export interface Listing { id: number; seller: string; remaining: number; unit_price: number; created_at: number; }

export async function fetchListings(max: number = 200): Promise<Listing[]> {
  if (!(await ensureModulesAvailability())) return [];
  try {
    const [raw] = await view(aptos, {
      function: fq(MARKET_MODULE_NAME, 'listings'),
      functionArguments: [],
      typeArguments: []
    });
    if (!Array.isArray(raw)) return [];
  return (raw as RawListing[]).map((l: RawListing) => ({
      id: Number(l.id),
      seller: String(l.seller),
      remaining: Number(l.remaining),
      unit_price: Number(l.unit_price),
      created_at: Number(l.created_at)
    })).slice(0, max);
  } catch { return []; }
}

export async function computeListingStats() {
  const listings = await fetchListings();
  const totalRemaining = listings.reduce((a,l)=>a+Number(l.remaining||0),0);
  const avgPrice = listings.length ? listings.reduce((a,l)=>a+Number(l.unit_price),0)/listings.length : 0;
  const highest = listings.reduce((m,l)=> l.unit_price>m ? l.unit_price : m, 0);
  return {
    count: listings.length,
    totalRemaining,
    avgPrice: Number(avgPrice.toFixed(2)),
    highest
  };
}

// (deprecated duplicate kept for backward compatibility if imported elsewhere) – remove in later cleanup.
export async function listTokensTxLegacy(sender: AccountAddressInput, amount: number, unitPrice: number) {
  const tx: SimpleTransaction = await aptos.transaction.build.simple({
    sender,
    data: {
      function: fq(MARKET_MODULE_NAME, 'list'),
      functionArguments: [amount, unitPrice],
      typeArguments: []
    }
  });
  return tx;
}

export async function fetchListing(id: number): Promise<Listing | null> {
  if (!(await ensureModulesAvailability())) return null;
  try {
    const [opt] = await view(aptos, {
      function: fq(MARKET_MODULE_NAME, 'get_listing'),
      functionArguments: [id],
      typeArguments: []
    });
    if (!opt) return null;
  const o = opt as Record<string, unknown>; // SDK returns a loosely typed Move struct
    return {
      id: Number(o.id),
      seller: String(o.seller),
      remaining: Number(o.remaining),
      unit_price: Number(o.unit_price),
      created_at: Number(o.created_at)
    };
  } catch { return null; }
}

export async function pendingAmount(id: number): Promise<number> {
  const [val] = await view(aptos, {
  function: fq(TREE_MODULE_NAME, 'pending_amount'),
    functionArguments: [id],
    typeArguments: []
  });
  return Number(val || 0);
}

function normalizeTree(raw: Record<string, unknown>): Tree {
  return {
    id: Number(raw.id),
    owner: String(raw.owner),
    rate_ppm: Number(raw.rate_ppm),
    status: Number(raw.status),
    metadata_uri: bytesToString(raw.metadata_uri),
    cumulative_claimed: Number(raw.cumulative_claimed),
    pending: 0
  };
}

function normalizeRequest(raw: Record<string, unknown>): Request {
  return {
    id: Number(raw.id),
    requester: String(raw.requester),
    metadata_uri: bytesToString(raw.metadata_uri),
    submitted_at: Number(raw.submitted_at),
    status: Number(raw.status),
    rate_ppm: Number(raw.rate_ppm),
  };
}
function bytesToString(bytes: unknown): string {
  if (Array.isArray(bytes)) {
    try { return new TextDecoder().decode(new Uint8Array(bytes as number[])); } catch { return ""; }
  }
  return String(bytes ?? "");
}

function hexToString(maybeHex: string): string {
  try {
    const s = maybeHex.startsWith('0x') ? maybeHex.slice(2) : maybeHex;
    if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2 === 1) return maybeHex;
    const arr = new Uint8Array(s.length / 2);
    for (let i = 0; i < s.length; i += 2) {
      arr[i/2] = parseInt(s.slice(i, i+2), 16);
    }
    return new TextDecoder().decode(arr);
  } catch { return maybeHex; }
}

function normalizeRequestFromResource(e: any): Request {
  let meta: string = '';
  const u = e?.metadata_uri;
  if (Array.isArray(u)) meta = bytesToString(u);
  else if (typeof u === 'string') meta = hexToString(u);
  else meta = String(u ?? '');
  return {
    id: Number(e?.id ?? 0),
    requester: String(e?.requester ?? ''),
    metadata_uri: meta,
    submitted_at: Number(e?.submitted_at ?? 0),
    status: Number(e?.status ?? 0),
    rate_ppm: Number(e?.rate_ppm ?? 0)
  };
}

// ---------------- Module availability check & status ----------------
let modulesChecked = false;
let modulesAvailable = false;
let lastModuleCheckError: string | null = null;

async function checkModuleExists(moduleName: string): Promise<boolean> {
  try {
    const base = (process.env.NEXT_PUBLIC_APTOS_INDEXER || 'https://api.devnet.aptoslabs.com');
    // This endpoint returns 200 with ABI when module exists
    const url = `${base}/v1/accounts/${MODULE_ADDRESS}/module/${moduleName}`;
    const resp = await fetch(url, { cache: 'no-store' });
    return resp.ok;
  } catch { return false; }
}

export async function ensureModulesAvailability(): Promise<boolean> {
  if (modulesChecked) return modulesAvailable;
  modulesChecked = true;
  try {
    const [a, b, c] = await Promise.all([
      checkModuleExists(TREE_MODULE_NAME),
      checkModuleExists(REQUESTS_MODULE_NAME),
      checkModuleExists(MARKET_MODULE_NAME)
    ]);
    modulesAvailable = a && b && c;
    if (!modulesAvailable) {
      lastModuleCheckError = `On-chain modules not found at ${MODULE_ADDRESS}. Update NEXT_PUBLIC_MIKO_ADDRESS or publish Move package.`;
      console.warn(lastModuleCheckError);
    }
  } catch (e: any) {
    modulesAvailable = false;
    lastModuleCheckError = e?.message || 'Failed to check module availability';
    console.warn('[miko] Module check failed:', lastModuleCheckError);
  }
  return modulesAvailable;
}

export function getModulesStatus() {
  return { checked: modulesChecked, available: modulesAvailable, error: lastModuleCheckError } as const;
}

// Allow callers (e.g., a Refresh button) to force re-check after a deployment
export function resetModuleAvailabilityCheck() {
  modulesChecked = false;
  lastModuleCheckError = null;
}
