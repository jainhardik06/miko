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

// Fallback local cache (populated after first fetch) to avoid redundant view calls in quick succession.
const treeCache = new Map<number, Tree>();

const TREE_MODULE_NAME = 'tree_nft';
const MARKET_MODULE_NAME = 'marketplace';

function fq(moduleName: string, func: string): `${string}::${string}::${string}` {
  return `${MODULE_ADDRESS}::${moduleName}::${func}` as `${string}::${string}::${string}`;
}

type ViewPayload = { function: string; functionArguments: unknown[]; typeArguments: string[] };
async function view(aptosClient: Aptos, data: ViewPayload): Promise<unknown[]> {
  return aptosClient.view({ payload: data as InputViewFunctionData });
}

interface RawListing { id: string | number; seller: string; remaining: string | number; unit_price: string | number; created_at: string | number; [k: string]: unknown; }

// Narrow shape for wallet submission result we rely on (hash only)
export interface TxResult { hash: string }

export async function fetchTrees(max: number = 100): Promise<Tree[]> {
  const result: Tree[] = [];
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
function bytesToString(bytes: unknown): string {
  if (Array.isArray(bytes)) {
    try { return new TextDecoder().decode(new Uint8Array(bytes as number[])); } catch { return ""; }
  }
  return String(bytes ?? "");
}
