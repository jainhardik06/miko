# Pinata IPFS Integration - Implementation Summary

**Date**: October 30, 2025  
**Status**: ✅ **IMPLEMENTED**  
**Risk Level**: ✅ **LOW** (No blockchain contract changes required)

---

## 🎯 Objective

Integrate Pinata IPFS for decentralized, production-ready storage of tree images, metadata, and disease photos across the entire minting → verification → approval → marketplace flow.

---

## ✅ What Was Changed

### 1. Frontend Minting Flow (`src/app/mint/page.tsx`)

**Changes Made:**
- ✅ **Line 544-545**: Added TypeScript type for disease photos array
- ✅ **Line 546-573**: Disease photos now uploaded to Pinata IPFS individually, returns `ipfs://` URIs
- ✅ **Line 576-596**: Build enriched metadata JSON with:
  - IPFS disease photo URIs
  - AI verification data (confidence, verified status)
  - Structured attributes (species, age, height, diseases)
- ✅ **Line 599-608**: Use `/api/ipfs/upload-bundle` endpoint (NOT `/api/storage/upload`)
- ✅ **Line 609**: Submit **IPFS URI** to blockchain (`ipfs://Qm...` format)

**Data Flow Before:**
```
Capture image → Upload to localhost → Submit HTTP URL → Blockchain
```

**Data Flow After:**
```
Capture image → Upload to Pinata IPFS → Get CID → Submit ipfs:// URI → Blockchain
Disease photos → Upload to Pinata IPFS → Get CIDs → Include in metadata JSON
```

**Example Metadata Structure:**
```json
{
  "schema": "miko.tree-request@v1",
  "capturedAt": 1730304000000,
  "location": { "lat": 12.34, "lon": 56.78 },
  "heading": 180,
  "image": "ipfs://QmXxxx...",
  "attributes": {
    "name": "Ancient Oak",
    "speciesCommon": "Oak",
    "speciesScientific": "Quercus robur",
    "age": 50,
    "heightM": 15,
    "girthCm": 120,
    "diseases": [
      {
        "name": "Leaf Spot",
        "appearance": "Brown spots on leaves",
        "photo": "ipfs://QmYyyy..."
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

---

### 2. Backend Admin Routes (`backend/src/routes/admin.routes.js`)

**Changes Made:**
- ✅ **Lines 528-563**: Enhanced IPFS URI handling:
  - Convert `ipfs://` URIs to Pinata gateway URLs
  - Fetch metadata from `https://gateway.pinata.cloud/ipfs/{cid}`
  - Extract and convert tree image URL to gateway format
  - Convert disease photo URLs to gateway format
  - Return `imageUrl` in response for admin UI

**Before:**
```javascript
// Only handled HTTP URLs
const fetchUrl = metadataUrl.startsWith('ipfs://')
  ? metadataUrl.replace('ipfs://', 'https://ipfs.io/ipfs/')
  : metadataUrl;
```

**After:**
```javascript
// Use Pinata gateway (faster, custom domain support)
if (metadataUrl.startsWith('ipfs://')) {
  const cid = metadataUrl.replace('ipfs://', '');
  const gateway = process.env.PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs';
  fetchUrl = `${gateway}/${cid}`;
}

// Also convert image and disease photos
if (metadata.image?.startsWith('ipfs://')) {
  imageUrl = `${gateway}/${metadata.image.replace('ipfs://', '')}`;
}

if (metadata.attributes?.diseases) {
  metadata.attributes.diseases = metadata.attributes.diseases.map(d => {
    if (d.photo?.startsWith('ipfs://')) {
      return { ...d, photo: `${gateway}/${d.photo.replace('ipfs://', '')}` };
    }
    return d;
  });
}
```

---

### 3. Profile Page (`src/app/profile/page.tsx`)

**Changes Made:**
- ✅ **Line 11**: Added `import React from 'react';` for hooks
- ✅ **Lines 440-475**: Enhanced `RequestCard` component:
  - Fetches metadata from IPFS automatically
  - Displays tree image in 16:9 aspect ratio
  - Shows tree name, species, AI verification badge
  - Confidence score displayed
  - Image error handling

**Visual Improvements:**
- 📸 **Tree photos** displayed prominently at top of card
- 🌳 **Species name** with emoji
- ✓ **AI Verified badge** with confidence %
- 🎨 **Better card layout** with image + content sections

**Before:**
```tsx
<div className="text-sm truncate text-neutral-300">{r.metadata_uri || 'no metadata'}</div>
```

**After:**
```tsx
{imageUrl && (
  <div className="w-full h-40 bg-neutral-800 relative">
    <img src={imageUrl} alt={`Request ${r.id}`} className="w-full h-full object-cover" />
  </div>
)}
{metadata?.attributes?.name && <div className="font-medium">{metadata.attributes.name}</div>}
{metadata?.attributes?.speciesCommon && <div>🌳 {metadata.attributes.speciesCommon}</div>}
{metadata?.verificationData?.aiVerified && (
  <div className="text-emerald-400">✓ AI Verified ({Math.round(confidence * 100)}%)</div>
)}
```

---

## 🔧 Backend Infrastructure (Already Existed)

### IPFS Routes (`backend/src/routes/ipfs.routes.js`)
✅ **Already implemented** - No changes needed

**Available Endpoints:**
- `POST /api/ipfs/upload` - Upload single file to Pinata
- `POST /api/ipfs/upload-json` - Upload JSON to Pinata
- `POST /api/ipfs/upload-bundle` - Upload image + metadata bundle (used by minting)

### Pinata Configuration (`backend/src/config/pinata.js`)
✅ **Already configured** - No changes needed

**Environment Variables:**
```env
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PINATA_API_KEY=947fb83507b2ef264431
PINATA_SECRET_API_KEY=d78edcc81e1a5ea8cae715fbf8e0a2ac42171611e5d4801481c9ea41fcfc9f9b
PINATA_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs
```

### Blockchain Proxy (`backend/src/routes/blockchain.routes.js`)
✅ **Already handles double-hex encoding** - No changes needed
- Properly decodes `metadata_uri` from blockchain
- Works with both HTTP and IPFS URIs

---

## 📝 Blockchain Contracts (No Changes Required)

### `tree_requests.move`
✅ **Already flexible** - Stores `metadata_uri: vector<u8>`
- Can store any string (HTTP, IPFS, etc.)
- No changes needed

### `tree_nft.move`
✅ **Already flexible** - Tree struct has `metadata_uri: vector<u8>`
- Can store any string
- No changes needed

**Why No Changes?**
- Contracts store metadata URI as raw bytes
- They don't care about URI format (HTTP vs IPFS)
- Frontend/backend handle URI resolution

---

## 🧪 Testing Checklist

### Phase 1: Minting with IPFS ✅
- [ ] Start backend: `cd backend && npm run dev`
- [ ] Start frontend: `npm run dev`
- [ ] Go to http://localhost:3000/mint
- [ ] Capture tree image
- [ ] Fill form (name, species, age, etc.)
- [ ] Add disease with photo (optional)
- [ ] Click "Verify with AI"
- [ ] Click "Confirm & Submit"
- [ ] **Verify in console**: "✅ Uploaded to IPFS: { image: 'ipfs://Qm...', metadata: 'ipfs://Qm...' }"
- [ ] Check Petra wallet transaction
- [ ] **Verify transaction args**: Should contain `ipfs://` URI (not `http://localhost`)

### Phase 2: Admin Approval ✅
- [ ] Go to http://localhost:3000/admin
- [ ] Login with admin credentials
- [ ] View pending requests
- [ ] **Verify images display** from Pinata gateway
- [ ] **Verify metadata shows** tree name, species, AI verification
- [ ] Approve request with CCT grant
- [ ] Check transaction on Aptos Explorer

### Phase 3: Profile Display ✅
- [ ] Go to http://localhost:3000/profile
- [ ] Connect wallet (same one used for minting)
- [ ] **Verify request cards show**:
  - ✅ Tree image from IPFS
  - ✅ Tree name
  - ✅ Species
  - ✅ AI verification badge
  - ✅ Status (Approved/Pending/Rejected)
- [ ] For approved requests, click "List CCT on Marketplace"
- [ ] **Verify modal shows** request info and CCT balance

### Phase 4: Marketplace (Future) ⏳
- [ ] View marketplace listings
- [ ] Verify tree previews show IPFS images
- [ ] Click listing to see full details
- [ ] Buy tokens

---

## 🔍 Verification Commands

### Check IPFS Upload
```bash
# After minting, check frontend console:
# Should see: "✅ Uploaded to IPFS: { image: 'ipfs://Qm...', metadata: 'ipfs://Qm...' }"

# Verify metadata is accessible:
curl https://gateway.pinata.cloud/ipfs/{CID}
```

### Check Blockchain Request
```bash
# View request on blockchain (replace address and request_id):
curl -X POST https://fullnode.devnet.aptoslabs.com/v1/view \
  -H "Content-Type: application/json" \
  -d '{
    "function": "0x6a6677bb2559869550af7ddf5303810731f4846a29bb3d0423d3ff1a26d78876::tree_requests::get_request",
    "type_arguments": [],
    "arguments": ["0"]
  }'

# Decode metadata_uri field - should be "ipfs://Qm..." (not "http://localhost...")
```

### Check Backend Proxy
```powershell
# Fetch requests from backend proxy:
Invoke-WebRequest http://localhost:5001/api/blockchain/requests?fresh=true | ConvertFrom-Json

# Verify metadata_uri field is decoded properly
```

---

## 🎉 Benefits Achieved

✅ **Decentralized Storage** - No single point of failure (IPFS distributed network)  
✅ **Production Ready** - No localhost URLs, works across all environments  
✅ **Permanent Data** - IPFS content is content-addressed (CID = hash of content)  
✅ **Web3 Native** - Blockchain (Aptos) + IPFS = true Web3 stack  
✅ **Faster Gateway** - Pinata's CDN faster than public IPFS gateways  
✅ **Consistent Flow** - Mint → Verify → Approve → Marketplace (all IPFS)  
✅ **Rich Metadata** - Disease photos, AI verification data, structured attributes  
✅ **Cost Effective** - Pinata free tier: 1GB storage, 100k reads/month  

---

## 🐛 Known Issues & Solutions

### Issue 1: IPFS Gateway Timeout
**Symptom**: Images don't load on profile page  
**Solution**: Pinata gateway is fast, but first fetch may take 1-2s. Loading state added.

### Issue 2: Old Requests (HTTP URLs)
**Symptom**: Existing requests in DB have `http://localhost` URLs  
**Solution**: Backend proxy handles both HTTP and IPFS URIs. Old requests still work.

### Issue 3: IPFS CID Not Pinned
**Symptom**: Content unavailable after 24h  
**Solution**: Pinata automatically pins uploaded content (stays forever in your account)

---

## 🔄 Rollback Plan

If IPFS causes issues:

1. **Keep `/api/storage/upload` route** - Already exists, not deleted
2. **Add feature flag**:
   ```typescript
   const USE_IPFS = process.env.NEXT_PUBLIC_USE_IPFS === 'true';
   const uploadEndpoint = USE_IPFS ? '/api/ipfs/upload-bundle' : '/api/storage/upload';
   ```
3. **Both systems work simultaneously** - Backend handles both HTTP and IPFS URIs

---

## 📦 Deployment Checklist

Before deploying to production:

1. **Environment Variables**:
   ```env
   # Backend .env
   PINATA_JWT=your_jwt_here
   PINATA_API_KEY=your_key_here
   PINATA_SECRET_API_KEY=your_secret_here
   PINATA_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs
   ```

2. **Test on Devnet**:
   - Mint 3-5 trees with IPFS
   - Verify all images load
   - Test approval flow
   - Test marketplace listing

3. **Monitor Pinata Usage**:
   - Check Pinata dashboard: https://app.pinata.cloud
   - Verify storage usage < 1GB (free tier)
   - Check request count < 100k/month

4. **Upgrade Plan (if needed)**:
   - Pinata Picnic: $20/mo (100GB storage, 1M reads)
   - Pinata Fiesta: $200/mo (1TB storage, 10M reads)

---

## 📚 Documentation Updated

1. ✅ **PINATA-IPFS-INTEGRATION-PLAN.md** - Planning document
2. ✅ **PINATA-IPFS-IMPLEMENTATION-SUMMARY.md** - This file (implementation summary)
3. 📝 **TODO**: Update `docs/architecture.md` with IPFS integration diagram

---

## 🚀 Next Steps

1. **Test Phase 1** (Minting):
   - Mint a new tree with disease photo
   - Verify IPFS upload in console
   - Check transaction on blockchain

2. **Test Phase 2** (Admin Approval):
   - Login to admin panel
   - View pending request
   - Verify image displays from Pinata
   - Approve request

3. **Test Phase 3** (Profile Display):
   - View profile page
   - Verify request card shows tree image
   - Test "List CCT on Marketplace" button

4. **Test Phase 4** (Marketplace) - Future:
   - Integrate IPFS metadata into marketplace listings
   - Show tree previews
   - Display full tree details before purchase

---

## ✅ Sign-Off

**Implementation Status**: ✅ **COMPLETE**  
**Testing Status**: ⏳ **PENDING USER TESTING**  
**Production Ready**: ✅ **YES** (with successful testing)  

**Files Modified**:
1. `src/app/mint/page.tsx` (Lines 522-620)
2. `backend/src/routes/admin.routes.js` (Lines 528-563)
3. `src/app/profile/page.tsx` (Lines 11, 438-497)

**Files Added**:
1. `docs/PINATA-IPFS-INTEGRATION-PLAN.md`
2. `docs/PINATA-IPFS-IMPLEMENTATION-SUMMARY.md`

**No Breaking Changes**:
- ✅ Old HTTP URLs still work (backend handles both)
- ✅ Blockchain contracts unchanged
- ✅ Database schema unchanged
- ✅ API routes unchanged (just using different endpoint)

---

**Ready for testing! 🎉**

Please test the minting flow and confirm that:
1. Images upload to Pinata IPFS successfully
2. Metadata contains IPFS URIs (`ipfs://Qm...`)
3. Admin panel displays images from Pinata gateway
4. Profile page shows tree images and metadata properly

If any issues arise, check the console logs for detailed error messages.
