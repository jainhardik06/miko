const MICRO_UNITS = 1_000_000;

function getFullnodeBase() {
  const url = process.env.APTOS_NODE_URL;
  if (url) {
    return url.replace(/\/?v1\/?$/, '');
  }
  return 'https://fullnode.devnet.aptoslabs.com';
}

const MODULE_ADDRESS = process.env.MIKO_ADDRESS || process.env.NEXT_PUBLIC_MIKO_ADDRESS;

function ensureModuleAddress() {
  if (!MODULE_ADDRESS) {
    throw new Error('MIKO_ADDRESS / NEXT_PUBLIC_MIKO_ADDRESS not configured');
  }
}

export async function fetchListing(listingId) {
  ensureModuleAddress();
  const base = getFullnodeBase();
  const type = encodeURIComponent(`${MODULE_ADDRESS}::marketplace::Registry`);
  const url = `${base}/v1/accounts/${MODULE_ADDRESS}/resource/${type}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to read registry (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  const list = Array.isArray(json?.data?.list) ? json.data.list : [];
  const raw = list.find((entry) => Number(entry?.id ?? entry?.listing_id) === Number(listingId));
  if (!raw) return null;
  const remaining = Number(raw?.remaining ?? raw?.remaining_micro ?? 0);
  return {
    id: Number(raw?.id ?? listingId),
    seller: String(raw?.seller || ''),
    remainingMicro: remaining,
    remainingTokens: Math.round(remaining / MICRO_UNITS),
    unitPrice: Number(raw?.unit_price ?? 0),
    createdAt: Number(raw?.created_at ?? 0)
  };
}

export async function fetchRegistrySnapshot() {
  ensureModuleAddress();
  const base = getFullnodeBase();
  const type = encodeURIComponent(`${MODULE_ADDRESS}::marketplace::Registry`);
  const url = `${base}/v1/accounts/${MODULE_ADDRESS}/resource/${type}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch registry (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  return Array.isArray(json?.data?.list) ? json.data.list : [];
}

export { MICRO_UNITS };
