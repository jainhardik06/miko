# 🎯 IPFS Integration Complete - Quick Start Guide

## ✅ What Was Done

Your entire minting → verification → approval → marketplace flow now uses **Pinata IPFS** for decentralized Web3 storage instead of local filesystem.

### Key Changes:

1. **Minting Page** (`src/app/mint/page.tsx`)
   - ✅ Tree images uploaded to Pinata IPFS
   - ✅ Disease photos uploaded to Pinata IPFS
   - ✅ Metadata JSON uploaded to Pinata IPFS
   - ✅ Blockchain stores `ipfs://Qm...` URIs (not `http://localhost`)

2. **Admin Panel** (`backend/src/routes/admin.routes.js`)
   - ✅ Fetches metadata from Pinata gateway
   - ✅ Converts IPFS URIs to viewable URLs
   - ✅ Displays tree images and disease photos

3. **Profile Page** (`src/app/profile/page.tsx`)
   - ✅ Request cards show tree images from IPFS
   - ✅ Display tree name, species, AI verification badge
   - ✅ Automatic metadata fetching from Pinata

---

## 🚀 Testing Your Changes

### Step 1: Start Development Servers

**Terminal 1 (Backend):**
```powershell
cd d:\miko\miko\backend
npm run dev
```

**Terminal 2 (Frontend):**
```powershell
cd d:\miko\miko
npm run dev
```

### Step 2: Test Minting with IPFS

1. Open: http://localhost:3000/mint
2. Click "Start Minting Process"
3. Grant camera permissions
4. Capture tree photo
5. Fill form:
   - Name: "Test Oak Tree"
   - Species: "Oak"
   - Age: 50
   - (Optional) Add disease with photo
6. Click "Verify with AI"
7. Click "Confirm & Submit"
8. **WATCH CONSOLE** - Should see:
   ```
   ✅ Uploaded to IPFS: { 
     image: { ipfsUri: 'ipfs://QmXxxx...', gatewayUrl: 'https://gateway.pinata.cloud/ipfs/QmXxxx...' },
     metadata: { ipfsUri: 'ipfs://QmYyyy...', gatewayUrl: 'https://gateway.pinata.cloud/ipfs/QmYyyy...' }
   }
   ```
9. Approve transaction in Petra wallet
10. **Verify transaction args** - Should contain `ipfs://` (not `http://localhost`)

### Step 3: Test Admin Approval

1. Open: http://localhost:3000/admin
2. Login with admin credentials
3. Go to "Verification" → "Pending Requests"
4. **VERIFY**: Tree image displays from Pinata gateway
5. **VERIFY**: Metadata shows tree name, species, AI data
6. Click "Approve" → Enter CCT grant (e.g., 100)
7. Submit approval

### Step 4: Test Profile Display

1. Open: http://localhost:3000/profile
2. Connect wallet (same wallet used for minting)
3. **VERIFY Request Cards Show**:
   - ✅ Tree image (from IPFS)
   - ✅ Tree name
   - ✅ Species with 🌳 emoji
   - ✅ AI Verified badge with confidence %
   - ✅ Status (Approved/Pending/Rejected)
4. For approved requests, click "List CCT on Marketplace"
5. Modal should show request info and CCT balance

---

## 🔍 Verification Commands

### Check IPFS Upload Success

Open browser console (F12) during minting and look for:
```
✅ Uploaded to IPFS: { image: 'ipfs://Qm...', metadata: 'ipfs://Qm...' }
```

### Check Blockchain Request

```powershell
# Replace {request_id} with actual request ID (e.g., 0, 1, 2)
Invoke-WebRequest http://localhost:5001/api/blockchain/requests?fresh=true | ConvertFrom-Json
```

Should see `metadata_uri` as `ipfs://Qm...` (not `http://localhost...`)

### Check Pinata Dashboard

1. Go to: https://app.pinata.cloud
2. Login with your account
3. Check "Files" - You should see newly uploaded images and metadata
4. Files are named like:
   - `disease-Leaf Spot` (disease photos)
   - `image-{timestamp}` (tree images)
   - `meta-{timestamp}.json` (metadata files)

---

## 🎨 Visual Improvements You'll See

### Before:
```
┌────────────────────────┐
│ Request #0             │
│ http://localhost:5001/ │
│ uploads/meta/...       │
│ Submitted 10/30/2025   │
│ [Approved]             │
└────────────────────────┘
```

### After:
```
┌────────────────────────┐
│ [TREE IMAGE FROM IPFS] │
│────────────────────────│
│ Request #0             │
│ Ancient Oak            │
│ 🌳 Oak                 │
│ ✓ AI Verified (95%)    │
│ Submitted 10/30/2025   │
│ [Approved]             │
│ [List CCT on Market]   │
└────────────────────────┘
```

---

## 📦 Environment Variables Required

Your backend `.env` should have (already in `.env.example`):

```env
# Pinata IPFS Configuration
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PINATA_API_KEY=947fb83507b2ef264431
PINATA_SECRET_API_KEY=d78edcc81e1a5ea8cae715fbf8e0a2ac42171611e5d4801481c9ea41fcfc9f9b
PINATA_GATEWAY_BASE=https://gateway.pinata.cloud/ipfs
```

**Copy from `.env.example` to `.env`** if not already done:
```powershell
cd d:\miko\miko\backend
Copy-Item .env.example .env
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Upload failed (500)"

**Cause**: Pinata API credentials not configured  
**Solution**: Check `backend/.env` has valid `PINATA_JWT` or `PINATA_API_KEY`

### Issue 2: Images not displaying on profile page

**Cause**: IPFS gateway slow on first fetch  
**Solution**: Wait 2-3 seconds, image should load. Check browser console for errors.

### Issue 3: Transaction args show "http://localhost..."

**Cause**: Using old `/api/storage/upload` endpoint  
**Solution**: Verify `src/app/mint/page.tsx` uses `/api/ipfs/upload-bundle` (line 599)

### Issue 4: "CORS error" when fetching from IPFS

**Cause**: Pinata gateway blocks some requests  
**Solution**: Use Pinata gateway URL (not `ipfs.io`), already configured

---

## ✅ Checklist - Confirm Everything Works

- [ ] Backend running on http://localhost:5001
- [ ] Frontend running on http://localhost:3000
- [ ] Pinata credentials in `backend/.env`
- [ ] Mint a tree → Console shows "✅ Uploaded to IPFS"
- [ ] Transaction submitted to blockchain
- [ ] Admin panel shows tree image from Pinata
- [ ] Profile page displays tree card with image
- [ ] Approved request shows "List CCT on Marketplace" button
- [ ] No errors in browser console
- [ ] No errors in backend terminal

---

## 📚 Documentation Files

1. **PINATA-IPFS-INTEGRATION-PLAN.md** - Original planning document
2. **PINATA-IPFS-IMPLEMENTATION-SUMMARY.md** - Detailed implementation summary
3. **IPFS-QUICK-START.md** - This file (testing guide)

---

## 🎉 What You Get

### Before (Local Storage):
❌ Images on `localhost:5001/uploads/` - breaks in production  
❌ Not decentralized - single point of failure  
❌ Not Web3 native - doesn't fit blockchain ecosystem  
❌ Metadata scattered across filesystem  

### After (IPFS Storage):
✅ Images on Pinata IPFS - production-ready, decentralized  
✅ Content-addressed storage - permanent, verifiable  
✅ Web3 native - blockchain + IPFS = true Web3  
✅ Rich metadata - tree data, AI verification, disease photos all in one JSON  
✅ Fast CDN - Pinata gateway faster than public IPFS nodes  
✅ Consistent flow - mint → approve → profile → marketplace (all IPFS)  

---

## 🚀 Next Steps After Testing

Once you've verified everything works:

1. **Deploy to production**:
   - Update production `.env` with Pinata credentials
   - Test on Aptos Testnet before Mainnet
   - Monitor Pinata usage dashboard

2. **Marketplace Integration** (Future):
   - Display tree previews from IPFS on marketplace page
   - Show full tree metadata when buying CCT tokens
   - Filter by species, AI verification status

3. **Enhanced Features** (Future):
   - Bulk upload for multiple trees
   - IPFS pinning status indicator
   - Metadata versioning (update tree info)
   - Gallery view of all user trees

---

## 📞 Need Help?

If you encounter issues:

1. **Check console logs**:
   - Frontend: Browser console (F12)
   - Backend: Terminal running `npm run dev`

2. **Verify environment**:
   - Pinata credentials valid
   - Backend and frontend both running
   - Wallet connected to Devnet

3. **Test Pinata directly**:
   ```powershell
   # Test upload endpoint
   Invoke-WebRequest http://localhost:5001/api/ipfs/upload-json `
     -Method POST `
     -Headers @{"Content-Type"="application/json"} `
     -Body '{"data":{"test":"hello"},"name":"test.json"}'
   ```

---

**Ready to test! 🎉**

Start both servers and try minting a tree. You should see IPFS URIs everywhere instead of localhost URLs.

**Status**: ✅ Implementation Complete  
**Testing**: ⏳ Pending Your Verification  
**Production Ready**: ✅ Yes (after successful testing)
