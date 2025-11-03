/**
 * Blockchain proxy routes - Caches blockchain data to avoid rate limiting
 */
import express from 'express';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const router = express.Router();

const config = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(config);

const MODULE_ADDRESS = process.env.MODULE_ADDRESS || '0x6a6677bb2559869550af7ddf5303810731f4846a29bb3d0423d3ff1a26d78876';

const MICRO_UNITS = 1_000_000;
const TOKENS_PER_CREDIT = 1;

function ratePpmToCredits(ratePpm = 0) {
  if (!Number.isFinite(ratePpm)) return 0;
  return Math.max(0, Math.round(ratePpm / MICRO_UNITS));
}

function ratePpmToTokens(ratePpm = 0) {
  return ratePpmToCredits(ratePpm) * TOKENS_PER_CREDIT;
}

// Helper to normalize blockchain data
function bytesToString(bytes) {
  // Handle array of bytes
  if (Array.isArray(bytes)) {
    try { 
      return new TextDecoder().decode(new Uint8Array(bytes)); 
    } catch { 
      return ""; 
    }
  }
  
  // Handle hex string (e.g., "0x...")
  if (typeof bytes === 'string' && bytes.startsWith('0x')) {
    try {
      const hex = bytes.slice(2);
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      let decoded = new TextDecoder().decode(arr);
      
      // If the decoded string is itself a hex string, decode it again
      if (decoded.startsWith('0x')) {
        const innerHex = decoded.slice(2);
        const innerArr = new Uint8Array(innerHex.length / 2);
        for (let i = 0; i < innerHex.length; i += 2) {
          innerArr[i / 2] = parseInt(innerHex.slice(i, i + 2), 16);
        }
        decoded = new TextDecoder().decode(innerArr);
      }
      
      return decoded;
    } catch {
      return "";
    }
  }
  
  return String(bytes || "");
}

function normalizeTree(raw) {
  return {
    id: Number(raw.id || 0),
    owner: String(raw.owner || ''),
    rate_ppm: Number(raw.rate_ppm || 0),
    status: Number(raw.status || 0),
    metadata_uri: bytesToString(raw.metadata_uri),
    cumulative_claimed: Number(raw.cumulative_claimed || 0),
    created_at: Number(raw.created_at || 0),
    last_claim: Number(raw.last_claim || 0),
    granted_ccr: ratePpmToCredits(Number(raw.rate_ppm || 0)),
    granted_cct: ratePpmToTokens(Number(raw.rate_ppm || 0))
  };
}

function normalizeRequest(raw) {
  return {
    id: Number(raw.id || 0),
    requester: String(raw.requester || ''),
    metadata_uri: bytesToString(raw.metadata_uri),
    submitted_at: Number(raw.submitted_at || 0),
    status: Number(raw.status || 0),
    rate_ppm: Number(raw.rate_ppm || 0),
    granted_ccr: ratePpmToCredits(Number(raw.rate_ppm || 0)),
    granted_cct: ratePpmToTokens(Number(raw.rate_ppm || 0))
  };
}

// In-memory cache with TTL
const cache = {
  trees: { data: null, timestamp: 0, ttl: 5000 }, // 5 seconds - fast updates
  requests: { data: null, timestamp: 0, ttl: 5000 } // 5 seconds - fast updates
};

function isCacheValid(cacheKey) {
  const cached = cache[cacheKey];
  return cached.data && (Date.now() - cached.timestamp) < cached.ttl;
}

/**
 * GET /api/blockchain/trees
 * Fetch trees from blockchain with caching
 */
router.get('/trees', async (req, res) => {
  try {
    // Allow cache bypass with ?fresh=true
    const skipCache = req.query.fresh === 'true';
    
    // Return cached data if valid and not bypassed
    if (!skipCache && isCacheValid('trees')) {
      return res.json({ trees: cache.trees.data, cached: true });
    }

    // Fetch trees directly from the Trees resource using REST API
    // This bypasses the need for view functions
    const trees = [];
    
    try {
      // Use the base fullnode URL without version path
      let base = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com';
      // Remove trailing /v1 if present
      base = base.replace(/\/v1\/?$/, '');
      
      const resourceType = encodeURIComponent(`${MODULE_ADDRESS}::tree_nft::Trees`);
      const url = `${base}/v1/accounts/${MODULE_ADDRESS}/resource/${resourceType}`;
      
      console.log('[Blockchain] Fetching trees from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const treesData = data?.data?.inner || [];
        
        console.log('[Blockchain] Found', treesData.length, 'trees in resource');
        
        // Normalize each tree
        for (const treeRaw of treesData) {
          trees.push(normalizeTree(treeRaw));
        }
      } else {
        const errorText = await response.text();
        console.warn('[Blockchain] Trees resource response:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Blockchain] Error fetching Trees resource:', error);
      // Continue with empty array
    }
    
    // Update cache
    cache.trees.data = trees;
    cache.trees.timestamp = Date.now();

    res.json({ trees, cached: false });
  } catch (error) {
    console.error('[Blockchain] Error fetching trees:', error);
    
    // Return cached data even if expired, better than nothing
    if (cache.trees.data) {
      return res.json({ trees: cache.trees.data, cached: true, stale: true });
    }
    
    res.status(500).json({ error: 'Failed to fetch trees from blockchain' });
  }
});

/**
 * GET /api/blockchain/requests
 * Fetch tree requests from blockchain with caching
 */
router.get('/requests', async (req, res) => {
  try {
    // Allow cache bypass with ?fresh=true
    const skipCache = req.query.fresh === 'true';
    
    // Return cached data if valid and not bypassed
    if (!skipCache && isCacheValid('requests')) {
      return res.json({ requests: cache.requests.data, cached: true });
    }

    // Fetch requests directly from the Requests resource using REST API
    const requests = [];
    
    try {
      // Use the base fullnode URL without version path
      let base = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com';
      // Remove trailing /v1 if present
      base = base.replace(/\/v1\/?$/, '');
      
      const resourceType = encodeURIComponent(`${MODULE_ADDRESS}::tree_requests::Requests`);
      const url = `${base}/v1/accounts/${MODULE_ADDRESS}/resource/${resourceType}`;
      
      console.log('[Blockchain] Fetching requests from:', url);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const requestsData = data?.data?.entries || [];
        
        console.log('[Blockchain] Found', requestsData.length, 'requests in resource');
        
        // Normalize each request
        for (const requestRaw of requestsData) {
          requests.push(normalizeRequest(requestRaw));
        }
      } else {
        const errorText = await response.text();
        console.warn('[Blockchain] Requests resource response:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Blockchain] Error fetching Requests resource:', error);
      // Continue with empty array
    }
    
    // Update cache
    cache.requests.data = requests;
    cache.requests.timestamp = Date.now();

    console.log(`[Blockchain] Fetched ${requests.length} requests from blockchain`);
    res.json({ requests, cached: false });
  } catch (error) {
    console.error('[Blockchain] Error fetching requests:', error);
    
    // Return cached data even if expired
    if (cache.requests.data) {
      return res.json({ requests: cache.requests.data, cached: true, stale: true });
    }
    
    res.status(500).json({ error: 'Failed to fetch requests from blockchain' });
  }
});

/**
 * POST /api/blockchain/refresh
 * Force refresh cache (for admin/debugging)
 */
router.post('/refresh', async (req, res) => {
  try {
    // Clear cache
    cache.trees.timestamp = 0;
    cache.requests.timestamp = 0;

    res.json({ message: 'Cache cleared, next request will fetch fresh data' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh cache' });
  }
});

export default router;
