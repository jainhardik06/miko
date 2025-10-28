/**
 * Blockchain proxy routes - Caches blockchain data to avoid rate limiting
 */
import express from 'express';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const router = express.Router();

const config = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(config);

const MODULE_ADDRESS = process.env.MODULE_ADDRESS || '0x6a6677bb2559869550af7ddf5303810731f4846a29bb3d0423d3ff1a26d78876';

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
    pending: 0
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

    // Fetch from blockchain - iterate through tree IDs
    const trees = [];
    const maxTrees = 200;
    
    for (let id = 0; id < maxTrees; id++) {
      try {
        const result = await aptos.view({
          payload: {
            function: `${MODULE_ADDRESS}::tree_nft::get_tree`,
            typeArguments: [],
            functionArguments: [id]
          }
        });

        if (!result || !result[0]) break; // No more trees
        trees.push(normalizeTree(result[0]));
      } catch (error) {
        // Tree doesn't exist, stop iteration
        break;
      }
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

    // Fetch ALL requests at once using get_all_requests (more efficient!)
    const result = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::tree_requests::get_all_requests`,
        typeArguments: [],
        functionArguments: []
      }
    });

    const rawRequests = result[0] || [];
    const requests = rawRequests.map(r => normalizeRequest(r));
    
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
