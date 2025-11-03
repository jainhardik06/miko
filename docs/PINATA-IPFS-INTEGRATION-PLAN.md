# Pinata IPFS Integration Plan

## Current State Analysis

### Data Flow (Current)
1. **Minting (Frontend)** → 3-step process with AI verification
   - Captures image (tree photo)
   - Collects form data (species, age, diseases, etc.)
   - AI verification via `/api/ai/verify`
   - Uploads to **LOCAL storage** via `/api/storage/upload` → saves to `uploads/images/` and `uploads/meta/`
   - Returns local URLs (e.g., `http://localhost:5001/uploads/meta/meta-123.json`)
   - Submits `metadata_uri` to blockchain via `tree_requests::submit(metadata_uri)`

2. **Admin Approval (Backend)** → Blockchain transaction
   - Admin calls `tree_requests::approve(request_id, rate_ppm)`
   - Blockchain mints Tree NFT via `tree_nft::mint_by_validator_internal()`
   - Tree stores `metadata_uri` from request
   - Backend syncs to MongoDB with decoded `metadata_uri`

3. **Profile Display** → Hybrid data
   - Fetches requests from blockchain via `/api/blockchain/requests`
   - Shows approved requests with CCT balance
   - "List CCT on Marketplace" button

4. **Marketplace** → CCT token trading
   - Users list CCT tokens via `marketplace::list(amount, price)`
   - Industries buy tokens via `marketplace::buy(listing_id)`

### Problems to Fix
❌ **LOCAL STORAGE**: Images/metadata stored on `localhost:5001/uploads/` - not production-ready  
❌ **NOT WEB3**: Should use IPFS for decentralized, permanent storage  
❌ **INCONSISTENT FLOW**: Metadata should be Pinata IPFS from mint → approval → marketplace  
❌ **MISSING DATA**: Disease photos uploaded separately, not integrated into metadata JSON

---

## Target State (Pinata IPFS Integration)

### New Data Flow
1. **Minting (Frontend)** → Use Pinata for ALL storage
   - Capture tree image → Upload to Pinata → Get IPFS CID
   - Collect disease photos (optional) → Upload each to Pinata → Get IPFS CIDs
   - Build complete metadata JSON with:
     ```json
     {
       "name": "Oak Tree #123",
       "image": "ipfs://Qm...",  // Main tree image CID
       "attributes": {
         "species": "Oak",
         "scientificName": "Quercus robur",
         "age": 50,
         "heightM": 15,
         "girthCm": 120,
         "location": { "lat": 12.34, "lon": 56.78, "heading": 180 },
         "diseases": [
           {
             "name": "Leaf Spot",
             "appearance": "Brown spots on leaves",
             "photo": "ipfs://Qm..."  // Disease photo CID
           }
         ]
       },
       "verificationData": {
         "aiVerified": true,
         "confidence": 0.95,
         "estimatedCCT": 100,
         "verifiedAt": "2025-10-30T12:00:00Z"
       }
     }
     ```
   - Upload metadata JSON to Pinata → Get metadata CID
   - Submit **IPFS URI** to blockchain: `ipfs://Qm...` (metadata CID)

2. **Admin Approval** → Blockchain + metadata fetching
   - Admin fetches request from blockchain
   - Decode `metadata_uri` → Should be `ipfs://Qm...`
   - Fetch metadata from Pinata gateway: `https://gateway.pinata.cloud/ipfs/Qm...`
   - Display full tree data (image, species, diseases, AI verification)
   - Approve → Calls `tree_requests::approve(request_id, rate_ppm)`
   - Tree NFT minted with IPFS `metadata_uri`

3. **Profile Display** → Show IPFS metadata
   - Fetch requests from blockchain
   - Decode `metadata_uri` → `ipfs://Qm...`
   - Fetch from Pinata gateway to display image/data
   - List CCT on marketplace

4. **Marketplace** → Display tree info from IPFS
   - Listings show tree preview (fetched from IPFS metadata)
   - Industries see full tree details before buying

---

## Implementation Plan

### Phase 1: Backend IPFS Routes (ALREADY EXISTS ✅)
Files: `backend/src/routes/ipfs.routes.js`, `backend/src/config/pinata.js`

**Existing Endpoints:**
- ✅ `POST /api/ipfs/upload` - Upload file to Pinata
- ✅ `POST /api/ipfs/upload-json` - Upload JSON to Pinata
- ✅ `POST /api/ipfs/upload-bundle` - Upload image + metadata bundle

**What to Add:**
- None - routes already exist

### Phase 2: Update Minting Flow (Frontend)
File: `src/app/mint/page.tsx`

**Changes Required:**
1. Replace `/api/storage/upload` with `/api/ipfs/upload-bundle`
2. Include disease photos in metadata:
   - Upload each disease photo to Pinata first
   - Add IPFS CIDs to metadata JSON
3. Change `metadataUrl` to IPFS format: `ipfs://Qm...`
4. Submit IPFS URI to blockchain (not HTTP URL)

**Code Changes:**
```typescript
// OLD (lines 542-548):
const uploadResp = await fetch(`${api}/api/storage/upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageDataUrl: capturedDataUrl, metadata: metadataObject })
});
const { metadataUrl } = await uploadResp.json();

// NEW:
// 1. Upload disease photos first
const diseasePhotos = await Promise.all(
  (form.diseaseEntries || []).map(async (disease) => {
    if (!disease.photoDataUrl) return { ...disease, photo: undefined };
    const photoResp = await fetch(`${api}/api/ipfs/upload`, {
      method: 'POST',
      body: createFormDataFromDataUrl(disease.photoDataUrl, 'disease-photo')
    });
    const { ipfsUri } = await photoResp.json();
    return { name: disease.name, appearance: disease.appearance, photo: ipfsUri };
  })
);

// 2. Build metadata with IPFS disease photos
const enrichedMetadata = {
  ...metadataObject,
  attributes: {
    ...metadataObject.form,
    diseases: diseasePhotos
  }
};

// 3. Upload bundle (image + metadata) to Pinata
const uploadResp = await fetch(`${api}/api/ipfs/upload-bundle`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    imageDataUrl: capturedDataUrl, 
    metadata: enrichedMetadata 
  })
});
const { metadata } = await uploadResp.json();
const metadataUri = metadata.ipfsUri; // ipfs://Qm...

// 4. Submit IPFS URI to blockchain
const arg0 = toHexUtf8(metadataUri); // Now it's ipfs://Qm... not http://localhost...
```

### Phase 3: Update Admin Dashboard (Backend)
File: `backend/src/routes/admin.routes.js`

**Changes Required:**
1. When fetching pending requests, resolve IPFS metadata:
   - Decode `metadata_uri` → `ipfs://Qm...`
   - Fetch from Pinata gateway: `https://gateway.pinata.cloud/ipfs/Qm...`
   - Return enriched data to admin UI

**Code Changes:**
```javascript
// Around lines 520-560 (fetchPendingRequests)
// OLD:
const metadataUrl = bytesToString(req.metadata_uri);
if (metadataUrl.startsWith('http')) {
  const metaResp = await fetch(metadataUrl);
  const metaData = await metaResp.json();
  // ...
}

// NEW:
const metadataUri = bytesToString(req.metadata_uri); // ipfs://Qm...
let metadataUrl = metadataUri;

// Convert IPFS URI to gateway URL
if (metadataUri.startsWith('ipfs://')) {
  const cid = metadataUri.replace('ipfs://', '');
  metadataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
}

const metaResp = await fetch(metadataUrl);
const metaData = await metaResp.json();

// Extract image URL (also IPFS)
let imageUrl = metaData.image;
if (imageUrl?.startsWith('ipfs://')) {
  const imgCid = imageUrl.replace('ipfs://', '');
  imageUrl = `https://gateway.pinata.cloud/ipfs/${imgCid}`;
}

// Extract disease photos (also IPFS)
const diseases = (metaData.attributes?.diseases || []).map(d => ({
  name: d.name,
  appearance: d.appearance,
  photo: d.photo?.startsWith('ipfs://') 
    ? `https://gateway.pinata.cloud/ipfs/${d.photo.replace('ipfs://', '')}`
    : d.photo
}));
```

### Phase 4: Update Profile Page (Frontend)
File: `src/app/profile/page.tsx`

**Changes Required:**
1. Decode `metadata_uri` from blockchain → `ipfs://Qm...`
2. Fetch from Pinata gateway to display images
3. Show full tree data when listing on marketplace

**Code Changes:**
```typescript
// When displaying requests:
const metadataUri = request.metadata_uri; // Already decoded by backend proxy
let imageUrl = null;

if (metadataUri.startsWith('ipfs://')) {
  try {
    const cid = metadataUri.replace('ipfs://', '');
    const metaResp = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    const metaData = await metaResp.json();
    imageUrl = metaData.image?.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  } catch (e) {
    console.error('Failed to fetch IPFS metadata:', e);
  }
}
```

### Phase 5: Update Marketplace (Future)
Files: `src/app/marketplace/page.tsx`, `backend/src/routes/marketplace.routes.js`

**Changes Required:**
1. When displaying listings, fetch tree metadata from IPFS
2. Show tree image, species, AI verification badge
3. Fetch from Pinata gateway for preview

---

## Environment Variables (Already Configured ✅)

```env
# Pinata API credentials
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PINATA_API_KEY=947fb83507b2ef264431
PINATA_SECRET_API_KEY=d78edcc81e1a5ea8cae715fbf8e0a2ac42171611e5d4801481c9ea41fcfc9f9b
PINATA_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs
```

---

## Blockchain Contract Updates (NOT NEEDED ✅)

**tree_requests.move:**
- ✅ Already stores `metadata_uri: vector<u8>` - can be any string (HTTP or IPFS)
- ✅ No changes needed

**tree_nft.move:**
- ✅ Already stores `metadata_uri: vector<u8>` in Tree struct
- ✅ No changes needed

**Contracts are flexible** - they just store the URI as bytes, don't care if it's HTTP or IPFS!

---

## Testing Checklist

### Phase 1: Minting with IPFS
- [ ] Mint tree with main image → Verify IPFS CID returned
- [ ] Add disease with photo → Verify disease photo uploaded to IPFS
- [ ] Check metadata JSON structure → Has `ipfs://` URIs for image and disease photos
- [ ] Submit to blockchain → `metadata_uri` is `ipfs://Qm...` (not HTTP)
- [ ] Check request on blockchain → Decode `metadata_uri` shows IPFS URI

### Phase 2: Admin Approval with IPFS
- [ ] View pending requests → Metadata fetched from Pinata gateway
- [ ] See tree image → Displayed from `https://gateway.pinata.cloud/ipfs/...`
- [ ] See disease photos → Displayed from Pinata gateway
- [ ] Approve request → Tree minted with IPFS metadata
- [ ] Check MongoDB Tree record → `metadataUri` is IPFS format

### Phase 3: Profile Display with IPFS
- [ ] View approved requests → Fetch from blockchain proxy
- [ ] Display tree images → Fetched from Pinata gateway
- [ ] List CCT on marketplace → Transaction succeeds
- [ ] Refresh page → All data consistent

### Phase 4: Marketplace with IPFS
- [ ] View listings → Tree previews show IPFS images
- [ ] Click listing → Full metadata displayed
- [ ] Buy tokens → Transaction succeeds

---

## Rollback Plan

If IPFS integration causes issues:

1. **Keep `/api/storage/upload` route** - don't delete it
2. **Add feature flag** in frontend:
   ```typescript
   const USE_IPFS = process.env.NEXT_PUBLIC_USE_IPFS === 'true';
   const uploadEndpoint = USE_IPFS ? '/api/ipfs/upload-bundle' : '/api/storage/upload';
   ```
3. **Backend can handle both** - check if `metadata_uri` starts with `ipfs://` or `http://`

---

## Benefits of IPFS Integration

✅ **Decentralized Storage** - No single point of failure  
✅ **Permanent Data** - IPFS content is content-addressed (CID = hash of data)  
✅ **Web3 Native** - Fits blockchain ecosystem (Aptos + IPFS)  
✅ **Production Ready** - No localhost URLs, works across networks  
✅ **Consistent Flow** - Mint → Verify → Approve → Marketplace (all IPFS)  
✅ **Cost Effective** - Pinata free tier: 1GB storage, 100k reads/month  

---

## Next Steps

1. ✅ Review this plan
2. Implement Phase 2 (Frontend minting)
3. Implement Phase 3 (Backend admin)
4. Implement Phase 4 (Frontend profile)
5. Test end-to-end flow
6. Deploy to production

---

**Status**: Ready for implementation  
**Estimated Time**: 2-3 hours  
**Risk Level**: Low (contracts don't need changes, IPFS routes already exist)
