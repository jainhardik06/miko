// Aptos client helpers for Miko PoC
// Provides typed wrappers around Move entry & view functions.
import { aptos } from '../state/store';
import { AccountAddressInput, SimpleTransaction, Aptos, InputViewFunctionData } from '@aptos-labs/ts-sdk';
import { MODULE_ADDRESS } from '../config';

export const MICRO_UNITS = 1_000_000;
// Each on-chain rate_ppm value represents micro-CCT, so 1 credit == 1 token.
export const TOKENS_PER_CREDIT = 1;

export function microToTokens(micro: number): number {
  if (!Number.isFinite(micro)) return 0;
  return Math.max(0, Math.round(micro / MICRO_UNITS));
}

export function tokensToMicro(tokens: number): number {
  if (!Number.isFinite(tokens)) return 0;
  if (!Number.isInteger(tokens)) {
    throw new Error('Token amount must be a whole number');
  }
  return tokens * MICRO_UNITS;
}

export function ratePpmToCredits(ratePpm: number): number {
  if (!Number.isFinite(ratePpm)) return 0;
  return Math.max(0, Math.round(ratePpm / MICRO_UNITS));
}

export function ratePpmToTokens(ratePpm: number): number {
  return ratePpmToCredits(ratePpm) * TOKENS_PER_CREDIT;
}

export async function getPendingCCT(address: string): Promise<number> {
  if (!(await ensureModulesAvailability())) return 0;
  try {
    const [pending] = await view(aptos, {
      function: fq('cct', 'pending'),
      functionArguments: [address],
      typeArguments: []
    });
    return Number(pending || 0);
  } catch {
    return 0;
  }
}

export async function buildClaimPendingTx(sender: AccountAddressInput): Promise<SimpleEntryFunctionTx | null> {
  if (!(await ensureModulesAvailability())) return null;
  return {
    sender,
    data: {
      function: fq('cct', 'claim_pending'),
      functionArguments: [],
      typeArguments: []
    }
  };
}

export type Tree = {
  id: number;
  owner: string;
  rate_ppm: number; // represents total granted CCT in micro units (legacy field name)
  status: number;
  metadata_uri: string;
  cumulative_claimed: number;
  created_at: number;
  last_claim: number;
  granted_ccr?: number;
  granted_cct?: number;
};

export type Request = {
  id: number;
  requester: string;
  metadata_uri: string;
  submitted_at: number;
  status: number; // 1=pending,2=approved,3=rejected
  rate_ppm: number;
  granted_ccr?: number;
  granted_cct?: number;
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

// Return a wallet-compatible transaction payload for listing tokens.
type SimpleEntryFunctionTx = { sender: AccountAddressInput; data: { function: string; functionArguments: unknown[]; typeArguments: string[] } };
export function listTokensTx(sender: AccountAddressInput, amountTokens: number, unitPrice: number): SimpleEntryFunctionTx {
  const amountMicro = tokensToMicro(amountTokens);
  return {
    sender,
    data: {
      function: fq(MARKET_MODULE_NAME, 'list'),
      functionArguments: [amountMicro, unitPrice],
      typeArguments: []
    }
  };
}

export function buyCCT(sender: AccountAddressInput, listingId: number, amount: number): SimpleEntryFunctionTx {
  const amountMicro = tokensToMicro(amount);
  return {
    sender,
    data: {
      function: fq(MARKET_MODULE_NAME, 'buy'),
      functionArguments: [listingId, amountMicro],
      typeArguments: []
    }
  };
}

export interface Listing {
  id: number;
  seller: string;
  remaining_micro: number;
  remaining_tokens: number;
  unit_price: number;
  created_at: number;
}

export async function fetchListings(max: number = 200): Promise<Listing[]> {
  if (!(await ensureModulesAvailability())) return [];
  try {
    const base = getFullnodeBase();
    const type = encodeURIComponent(`${MODULE_ADDRESS}::${MARKET_MODULE_NAME}::Registry`);
    const url = `${base}/v1/accounts/${MODULE_ADDRESS}/resource/${type}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      console.warn('[aptos] fetchListings registry error', resp.status);
      return [];
    }
    const json = await resp.json();
    const list: RawListing[] = Array.isArray(json?.data?.list) ? json.data.list : [];
    return list.slice(0, max).map(normalizeListing);
  } catch (error) {
    console.error('[aptos] fetchListings failed:', error);
    return [];
  }
}

export async function computeListingStats() {
  const listings = await fetchListings();
  const totalMicro = listings.reduce((a, l) => a + Number(l.remaining_micro || 0), 0);
  const totalRemaining = microToTokens(totalMicro);
  const avgPrice = listings.length ? listings.reduce((a, l) => a + Number(l.unit_price), 0) / listings.length : 0;
  const highest = listings.reduce((m, l) => (l.unit_price > m ? l.unit_price : m), 0);
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
  const listings = await fetchListings();
  return listings.find((l) => l.id === id) ?? null;
}

function normalizeTree(raw: Record<string, unknown>): Tree {
  const rate = Number(raw.rate_ppm);
  return {
    id: Number(raw.id),
    owner: String(raw.owner),
    rate_ppm: rate,
    status: Number(raw.status),
    metadata_uri: bytesToString(raw.metadata_uri),
    cumulative_claimed: Number(raw.cumulative_claimed),
    created_at: Number(raw.created_at || 0),
    last_claim: Number(raw.last_claim || 0),
    granted_ccr: ratePpmToCredits(rate),
    granted_cct: ratePpmToTokens(rate)
  };
}

function normalizeListing(raw: RawListing): Listing {
  const remainingMicro = Number(raw.remaining ?? (raw as any)?.remaining_micro ?? 0);
  return {
    id: Number(raw.id ?? 0),
    seller: String(raw.seller ?? ''),
    remaining_micro: remainingMicro,
    remaining_tokens: microToTokens(remainingMicro),
    unit_price: Number(raw.unit_price ?? (raw as any)?.price ?? 0),
    created_at: Number(raw.created_at ?? (raw as any)?.listed_at ?? 0)
  };
}

function normalizeRequest(raw: Record<string, unknown>): Request {
  const rate = Number(raw.rate_ppm);
  return {
    id: Number(raw.id),
    requester: String(raw.requester),
    metadata_uri: bytesToString(raw.metadata_uri),
    submitted_at: Number(raw.submitted_at),
    status: Number(raw.status),
    rate_ppm: rate,
    granted_ccr: ratePpmToCredits(rate),
    granted_cct: ratePpmToTokens(rate),
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
  const rate = Number(e?.rate_ppm ?? 0);
  return {
    id: Number(e?.id ?? 0),
    requester: String(e?.requester ?? ''),
    metadata_uri: meta,
    submitted_at: Number(e?.submitted_at ?? 0),
    status: Number(e?.status ?? 0),
    rate_ppm: rate,
    granted_ccr: ratePpmToCredits(rate),
    granted_cct: ratePpmToTokens(rate)
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

// Get CCT balance for an address
export async function getCCTBalance(address: string): Promise<number> {
  if (!(await ensureModulesAvailability())) return 0;
  try {
    // Use Aptos SDK's built-in coin balance query instead of custom view function
    // This directly reads the CoinStore<CCT> resource from the account
    const coinType = `${MODULE_ADDRESS}::cct::CCT`;
    
    try {
      const balance = await aptos.getAccountCoinAmount({
        accountAddress: address,
        coinType: coinType as `${string}::${string}::${string}`
      });
      return Number(balance || 0);
    } catch (innerError: any) {
      // If CoinStore doesn't exist for this user, balance is 0
      if (innerError?.message?.includes('Resource not found') || 
          innerError?.message?.includes('not found') ||
          innerError?.status === 404) {
        return 0;
      }
      throw innerError;
    }
  } catch (error: any) {
    console.error('[getCCTBalance] Error:', error);
    return 0;
  }
}
