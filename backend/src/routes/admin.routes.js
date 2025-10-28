import { Router } from 'express';
import { AptosClient, AptosAccount, HexString, TxnBuilderTypes, BCS } from 'aptos';
import { 
  signAdminToken, 
  verifySuperAdminCredentials,
  verifyVerificationAdminCredentials,
  requireSuperAdmin,
  requireVerificationAdmin,
  requireAdminAuth,
  hashPassword
} from '../middleware/adminAuth.js';
import VerificationAdmin from '../models/verificationAdmin.model.js';
import TreeSubmission from '../models/treeSubmission.model.js';
import User from '../models/user.model.js';

const router = Router();

// Initialize Aptos client
const NODE_URL = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
const aptosClient = new AptosClient(NODE_URL);

// ==================== AUTHENTICATION ====================

// Super Admin Login
router.post('/auth/super-admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const isValid = await verifySuperAdminCredentials(username, password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAdminToken({
      adminType: 'SUPER_ADMIN',
      username,
      loginAt: Date.now()
    });

    // Set HTTP-only cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({
      success: true,
      adminType: 'SUPER_ADMIN',
      username,
      token
    });
  } catch (err) {
    console.error('[admin] Super admin login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Verification Admin Login
router.post('/auth/verification-admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = await verifyVerificationAdminCredentials(username, password);
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials or account disabled' });
    }

    const token = signAdminToken({
      adminType: 'VERIFICATION_ADMIN',
      adminId: admin.id,
      username: admin.username,
      loginAt: Date.now()
    });

    // Set HTTP-only cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({
      success: true,
      adminType: 'VERIFICATION_ADMIN',
      username: admin.username,
      id: admin.id,
      token
    });
  } catch (err) {
    console.error('[admin] Verification admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin Logout
router.post('/auth/logout', requireAdminAuth, (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// Get current admin profile
router.get('/auth/me', requireAdminAuth, async (req, res) => {
  try {
    const profile = {
      adminType: req.admin.adminType,
      username: req.admin.username
    };

    if (req.admin.adminType === 'VERIFICATION_ADMIN') {
      const admin = await VerificationAdmin.findById(req.admin.adminId);
      if (admin) {
        profile.id = admin._id.toString();
        profile.createdAt = admin.createdAt;
        profile.lastLogin = admin.lastLogin;
      }
    }

    res.json(profile);
  } catch (err) {
    console.error('[admin] Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ==================== SUPER ADMIN: VERIFICATION ADMIN MANAGEMENT ====================

// Create Verification Admin
router.post('/verification-admins', requireSuperAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if username already exists
    const existing = await VerificationAdmin.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await hashPassword(password);

    const admin = await VerificationAdmin.create({
      username,
      passwordHash,
      createdBy: req.admin.username
    });

    res.status(201).json({
      success: true,
      admin: {
        id: admin._id.toString(),
        username: admin.username,
        isEnabled: admin.isEnabled,
        createdAt: admin.createdAt
      }
    });
  } catch (err) {
    console.error('[admin] Create verification admin error:', err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// List all Verification Admins
router.get('/verification-admins', requireSuperAdmin, async (req, res) => {
  try {
    const admins = await VerificationAdmin.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({
      admins: admins.map(a => ({
        id: a._id.toString(),
        username: a.username,
        isEnabled: a.isEnabled,
        createdBy: a.createdBy,
        lastLogin: a.lastLogin,
        createdAt: a.createdAt,
        verificationCount: a.verificationHistory?.length || 0
      }))
    });
  } catch (err) {
    console.error('[admin] List verification admins error:', err);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Get single Verification Admin
router.get('/verification-admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const admin = await VerificationAdmin.findById(req.params.id)
      .select('-passwordHash');

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({
      id: admin._id.toString(),
      username: admin.username,
      isEnabled: admin.isEnabled,
      createdBy: admin.createdBy,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      verificationHistory: admin.verificationHistory
    });
  } catch (err) {
    console.error('[admin] Get verification admin error:', err);
    res.status(500).json({ error: 'Failed to fetch admin' });
  }
});

// Update Verification Admin
router.patch('/verification-admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, isEnabled } = req.body;
    const updates = {};

    if (username !== undefined) {
      // Check if new username is taken
      const existing = await VerificationAdmin.findOne({ 
        username, 
        _id: { $ne: req.params.id } 
      });
      if (existing) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      updates.username = username;
    }

    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      updates.passwordHash = await hashPassword(password);
    }

    if (isEnabled !== undefined) {
      updates.isEnabled = Boolean(isEnabled);
    }

    const admin = await VerificationAdmin.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({
      success: true,
      admin: {
        id: admin._id.toString(),
        username: admin.username,
        isEnabled: admin.isEnabled,
        updatedAt: admin.updatedAt
      }
    });
  } catch (err) {
    console.error('[admin] Update verification admin error:', err);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// Delete Verification Admin
router.delete('/verification-admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const admin = await VerificationAdmin.findByIdAndDelete(req.params.id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ 
      success: true, 
      message: 'Admin deleted successfully' 
    });
  } catch (err) {
    console.error('[admin] Delete verification admin error:', err);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// ==================== VERIFICATION WORKFLOW ====================

// Get dashboard statistics (both admin types)
router.get('/dashboard/stats', requireAdminAuth, async (req, res) => {
  try {
    const MIKO_ADDRESS = process.env.NEXT_PUBLIC_MIKO_ADDRESS || process.env.MIKO_ADDRESS;
    
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    // Fetch stats from blockchain
    if (MIKO_ADDRESS) {
      try {
        // Get all requests from blockchain
        const allRequestsPayload = {
          function: `${MIKO_ADDRESS}::tree_requests::get_all_requests`,
          type_arguments: [],
          arguments: []
        };
        const allRequestsResponse = await aptosClient.view(allRequestsPayload);
        
        if (allRequestsResponse && allRequestsResponse[0]) {
          const requests = allRequestsResponse[0];
          requests.forEach(req => {
            if (req.status === 1) pendingCount++; // PENDING
            else if (req.status === 2) approvedCount++; // APPROVED
            else if (req.status === 3) rejectedCount++; // REJECTED
          });
        }
      } catch (blockchainError) {
        console.error('[admin] Error fetching blockchain stats:', blockchainError);
        // Fallback to database counts if blockchain fails
        pendingCount = await TreeSubmission.countDocuments({ status: 'PENDING' });
        approvedCount = await Tree.countDocuments({ status: 'APPROVED' });
        rejectedCount = await TreeSubmission.countDocuments({ status: 'REJECTED' });
      }
    } else {
      // Fallback to database if no blockchain configured
      pendingCount = await TreeSubmission.countDocuments({ status: 'PENDING' });
      approvedCount = await Tree.countDocuments({ status: 'APPROVED' });
      rejectedCount = await TreeSubmission.countDocuments({ status: 'REJECTED' });
    }

    const totalUsers = await User.countDocuments();

    // Get recent activity from verification history
    let recentActivity = [];
    if (req.admin.adminType === 'VERIFICATION_ADMIN' && req.admin.adminId) {
      const admin = await VerificationAdmin.findById(req.admin.adminId);
      if (admin && admin.verificationHistory) {
        recentActivity = admin.verificationHistory
          .slice(-10)
          .reverse()
          .map(h => ({
            requestId: h.requestId,
            action: h.action,
            timestamp: h.timestamp,
            cctGranted: h.cctGranted
          }));
      }
    } else {
      // For super admin, get all recent verifications
      const admins = await VerificationAdmin.find().limit(10);
      recentActivity = admins.flatMap(a => 
        (a.verificationHistory || []).slice(-5).map(h => ({
          requestId: h.requestId,
          action: h.action,
          timestamp: h.timestamp,
          cctGranted: h.cctGranted,
          adminUsername: a.username
        }))
      ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
    }

    res.json({
      stats: {
        pendingRequests: pendingCount,
        approvedTrees: approvedCount,
        rejectedRequests: rejectedCount,
        totalUsers
      },
      recentActivity
    });
  } catch (err) {
    console.error('[admin] Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get verification queue (pending requests from blockchain)
router.get('/verification/queue', requireVerificationAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Fetch pending requests from Aptos blockchain
    const APTOS_NODE = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
    const MIKO_ADDRESS = process.env.NEXT_PUBLIC_MIKO_ADDRESS || process.env.MIKO_ADDRESS;
    
    if (!MIKO_ADDRESS) {
      return res.status(500).json({ error: 'Miko contract address not configured' });
    }

    // Call the view function to get all pending requests
    const viewPayload = {
      function: `${MIKO_ADDRESS}::tree_requests::get_all_pending`,
      type_arguments: [],
      arguments: []
    };

    const response = await fetch(`${APTOS_NODE}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viewPayload)
    });

    if (!response.ok) {
      console.error('[admin] Failed to fetch from blockchain:', response.status);
      return res.status(500).json({ error: 'Failed to fetch requests from blockchain' });
    }

    const data = await response.json();
    
    // data should be an array of RequestView structs
    const allRequests = data[0] || [];
    
    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedRequests = allRequests.slice(skip, skip + parseInt(limit));
    
    // Format the requests for frontend
    const formattedRequests = paginatedRequests.map(r => ({
      id: r.id.toString(),
      userId: r.requester,
      username: r.requester.substring(0, 8) + '...',
      location: { type: 'Point', coordinates: [0, 0] }, // Will be in metadata
      metadata_uri: r.metadata_uri,
      createdAt: new Date(parseInt(r.submitted_at) * 1000).toISOString(),
      status: r.status === 1 ? 'PENDING' : (r.status === 2 ? 'APPROVED' : 'REJECTED'),
      estimatedCCT: r.rate_ppm > 0 ? Math.round(r.rate_ppm / 10000) : 10
    }));

    res.json({
      requests: formattedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allRequests.length,
        totalPages: Math.ceil(allRequests.length / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[admin] Verification queue error:', err);
    res.status(500).json({ error: 'Failed to fetch queue: ' + err.message });
  }
});

// Get full request details from blockchain
router.get('/verification/requests/:id', requireVerificationAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const APTOS_NODE = process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
    const MIKO_ADDRESS = process.env.NEXT_PUBLIC_MIKO_ADDRESS || process.env.MIKO_ADDRESS;
    
    if (!MIKO_ADDRESS) {
      return res.status(500).json({ error: 'Miko contract address not configured' });
    }

    console.log('[admin] Fetching request details for ID:', requestId);

    // Call the view function to get specific request
    const viewPayload = {
      function: `${MIKO_ADDRESS}::tree_requests::get_request`,
      type_arguments: [],
      arguments: [requestId.toString()] // Ensure it's a string number
    };

    console.log('[admin] View payload:', JSON.stringify(viewPayload));

    const response = await fetch(`${APTOS_NODE}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viewPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin] Blockchain error:', response.status, errorText);
      return res.status(500).json({ error: 'Failed to fetch request from blockchain: ' + errorText });
    }

    const data = await response.json();
    console.log('[admin] Blockchain response:', JSON.stringify(data));
    
    // data is an array with one element containing Option<RequestView>
    // Format: [{ vec: [RequestView] }]
    if (!data || data.length === 0 || !data[0] || !data[0].vec || data[0].vec.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const r = data[0].vec[0];
    console.log('[admin] Request data:', JSON.stringify(r));

    // Decode metadata_uri from hex string to URL
    let metadataUrl = '';
    if (r.metadata_uri && r.metadata_uri.startsWith('0x')) {
      try {
        const hexString = r.metadata_uri.substring(2);
        const bytes = [];
        for (let i = 0; i < hexString.length; i += 2) {
          bytes.push(parseInt(hexString.substr(i, 2), 16));
        }
        metadataUrl = new TextDecoder().decode(new Uint8Array(bytes));
        console.log('[admin] Decoded metadata URL:', metadataUrl);
      } catch (err) {
        console.error('[admin] Failed to decode metadata_uri:', err);
      }
    }

    // Fetch metadata from URL if available
    let metadata = {};
    if (metadataUrl && (metadataUrl.startsWith('http') || metadataUrl.startsWith('ipfs'))) {
      try {
        // Convert IPFS URLs to gateway URLs
        const fetchUrl = metadataUrl.startsWith('ipfs://')
          ? metadataUrl.replace('ipfs://', 'https://ipfs.io/ipfs/')
          : metadataUrl;
        
        console.log('[admin] Fetching metadata from:', fetchUrl);
        const metaResponse = await fetch(fetchUrl);
        if (metaResponse.ok) {
          metadata = await metaResponse.json();
          console.log('[admin] Metadata fetched:', JSON.stringify(metadata));
        }
      } catch (err) {
        console.error('[admin] Failed to fetch metadata:', err);
      }
    }

    res.json({
      id: r.id.toString(),
      user: {
        id: r.requester,
        username: r.requester.substring(0, 8) + '...',
        role: 'user'
      },
      location: metadata.location || { type: 'Point', coordinates: [0, 0] },
      aiDecision: metadata.aiDecision || {},
      createdAt: new Date(parseInt(r.submitted_at) * 1000).toISOString(),
      status: r.status === 1 ? 'PENDING' : (r.status === 2 ? 'APPROVED' : 'REJECTED'),
      estimatedCCT: r.rate_ppm > 0 ? Math.round(r.rate_ppm / 10000) : 10,
      metadata: metadata
    });
  } catch (err) {
    console.error('[admin] Request details error:', err);
    res.status(500).json({ error: 'Failed to fetch request details: ' + err.message });
  }
});

// Approve request with CCT grant (calls blockchain)
router.post('/verification/requests/:id/approve', requireVerificationAdmin, async (req, res) => {
  try {
    const { cctGrant, notes } = req.body;
    const requestId = req.params.id;

    if (!cctGrant || cctGrant <= 0) {
      return res.status(400).json({ error: 'Valid CCT grant amount required' });
    }

    const MIKO_ADDRESS = process.env.NEXT_PUBLIC_MIKO_ADDRESS || process.env.MIKO_ADDRESS;
    const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
    
    if (!MIKO_ADDRESS) {
      return res.status(500).json({ error: 'Miko contract address not configured' });
    }

    if (!ADMIN_PRIVATE_KEY) {
      return res.status(500).json({ 
        error: 'Admin wallet not configured. Set ADMIN_PRIVATE_KEY in environment to enable on-chain approvals.' 
      });
    }

    // Convert CCT to rate_ppm (CCT * 10000)
    const ratePpm = Math.round(cctGrant * 10000);

    console.log('[admin] Approving request on blockchain:', { requestId, cctGrant, ratePpm });

    // Create admin account from private key (remove 0x prefix if present)
    const privateKeyHex = ADMIN_PRIVATE_KEY.startsWith('0x') 
      ? ADMIN_PRIVATE_KEY.substring(2) 
      : ADMIN_PRIVATE_KEY;
    const adminAccount = new AptosAccount(new HexString(privateKeyHex).toUint8Array());

    console.log('[admin] Admin account:', adminAccount.address().hex());

    // Build transaction payload
    const payload = {
      type: 'entry_function_payload',
      function: `${MIKO_ADDRESS}::tree_requests::approve`,
      type_arguments: [],
      arguments: [
        requestId.toString(), // u64
        ratePpm.toString()    // u64
      ]
    };

    console.log('[admin] Transaction payload:', JSON.stringify(payload));

    // Submit transaction
    const txnRequest = await aptosClient.generateTransaction(
      adminAccount.address(),
      payload
    );

    const signedTxn = await aptosClient.signTransaction(adminAccount, txnRequest);
    const committedTxn = await aptosClient.submitTransaction(signedTxn);

    console.log('[admin] Transaction submitted:', committedTxn.hash);

    // Wait for transaction confirmation
    try {
      const executedTransaction = await aptosClient.waitForTransaction(committedTxn.hash);
      console.log('[admin] Transaction confirmed:', JSON.stringify(executedTransaction));
      
      // Check if transaction was successful
      if (executedTransaction && executedTransaction.success === false) {
        throw new Error('Transaction failed on blockchain');
      }
    } catch (waitError) {
      console.error('[admin] Error waiting for transaction:', waitError);
      // Transaction was submitted but we couldn't confirm it immediately
      // This might be okay - the transaction could still be processing
    }

    // Fetch the approved request details from blockchain
    let requestDetails;
    try {
      const detailsPayload = {
        function: `${MIKO_ADDRESS}::tree_requests::get_request`,
        type_arguments: [],
        arguments: [requestId.toString()]
      };
      const detailsResponse = await aptosClient.view(detailsPayload);
      console.log('[admin] Request details after approval:', JSON.stringify(detailsResponse));
      
      if (detailsResponse && detailsResponse[0] && detailsResponse[0].vec && detailsResponse[0].vec[0]) {
        requestDetails = detailsResponse[0].vec[0];
      }
    } catch (viewError) {
      console.error('[admin] Error fetching request details after approval:', viewError);
    }

    // Create Tree record in MongoDB for marketplace and profile display
    if (requestDetails) {
      try {
        const Tree = (await import('../models/tree.model.js')).default;
        const User = (await import('../models/user.model.js')).default;
        
        // Convert requester address to userId (find or create user)
        const requesterAddress = requestDetails.requester;
        let user = await User.findOne({ 'authMethods.wallets.address': requesterAddress });
        
        if (!user) {
          // Create a basic user record for blockchain-only users
          user = await User.create({
            role: 'INDIVIDUAL',
            authMethods: {
              wallets: [{
                address: requesterAddress,
                network: 'aptos',
                addedAt: new Date()
              }]
            },
            createdAt: new Date()
          });
          console.log('[admin] Created user record for blockchain address:', requesterAddress);
        }

        // Decode metadata_uri from hex if needed
        let metadataUri = '';
        if (requestDetails.metadata_uri) {
          try {
            const hexString = requestDetails.metadata_uri.startsWith('0x') 
              ? requestDetails.metadata_uri.substring(2) 
              : requestDetails.metadata_uri;
            const bytes = Buffer.from(hexString, 'hex');
            metadataUri = bytes.toString('utf8');
          } catch (e) {
            metadataUri = requestDetails.metadata_uri;
          }
        }

        // Create Tree record
        const tree = await Tree.create({
          userId: user._id,
          blockchainRequestId: requestId,
          blockchainTreeId: requestDetails.id, // or derive from events
          location: { type: 'Point', coordinates: [0, 0] }, // TODO: parse from metadata
          metadataUri: metadataUri,
          ratePpm: requestDetails.rate_ppm,
          cctGranted: cctGrant,
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: req.admin.adminType === 'VERIFICATION_ADMIN' ? req.admin.adminId : 'SUPER_ADMIN',
          mintedAt: new Date()
        });

        console.log('[admin] Created Tree record in MongoDB:', tree._id);

        // Update user stats
        await User.findByIdAndUpdate(user._id, {
          $inc: { 'stats.treesApproved': 1, 'stats.totalCCT': cctGrant }
        });

      } catch (dbError) {
        console.error('[admin] Error creating Tree record:', dbError);
        // Don't fail the approval if DB sync fails - blockchain is source of truth
      }
    }

    // Record in verification history for tracking
    if (req.admin.adminType === 'VERIFICATION_ADMIN' && req.admin.adminId) {
      try {
        await VerificationAdmin.findByIdAndUpdate(req.admin.adminId, {
          $push: {
            verificationHistory: {
              requestId: requestId,
              action: 'APPROVED',
              timestamp: new Date(),
              cctGranted: cctGrant
            }
          },
          $inc: { 'stats.totalApproved': 1 }
        });
        
        // Also update total CCT granted stat
        await VerificationAdmin.findByIdAndUpdate(req.admin.adminId, {
          $inc: { 'stats.totalCCTGranted': cctGrant }
        });
      } catch (err) {
        console.error('[admin] Failed to update verification history:', err);
      }
    }

    res.json({
      success: true,
      message: 'Request approved on blockchain',
      transactionHash: committedTxn.hash,
      requestId,
      cctGranted: cctGrant,
      ratePpm,
      explorerUrl: `https://explorer.aptoslabs.com/txn/${committedTxn.hash}?network=devnet`
    });
  } catch (err) {
    console.error('[admin] Approve request error:', err);
    res.status(500).json({ error: 'Failed to approve request: ' + err.message });
  }
});

// Reject request (calls blockchain)
router.post('/verification/requests/:id/reject', requireVerificationAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const requestId = req.params.id;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason required' });
    }

    const MIKO_ADDRESS = process.env.NEXT_PUBLIC_MIKO_ADDRESS || process.env.MIKO_ADDRESS;
    const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
    
    if (!MIKO_ADDRESS) {
      return res.status(500).json({ error: 'Miko contract address not configured' });
    }

    if (!ADMIN_PRIVATE_KEY) {
      return res.status(500).json({ 
        error: 'Admin wallet not configured. Set ADMIN_PRIVATE_KEY in environment to enable on-chain rejections.' 
      });
    }

    console.log('[admin] Rejecting request on blockchain:', { requestId, reason });

    // Create admin account from private key (remove 0x prefix if present)
    const privateKeyHex = ADMIN_PRIVATE_KEY.startsWith('0x') 
      ? ADMIN_PRIVATE_KEY.substring(2) 
      : ADMIN_PRIVATE_KEY;
    const adminAccount = new AptosAccount(new HexString(privateKeyHex).toUint8Array());

    // Build transaction payload
    const payload = {
      type: 'entry_function_payload',
      function: `${MIKO_ADDRESS}::tree_requests::reject`,
      type_arguments: [],
      arguments: [requestId.toString()] // u64
    };

    // Submit transaction
    const txnRequest = await aptosClient.generateTransaction(
      adminAccount.address(),
      payload
    );

    const signedTxn = await aptosClient.signTransaction(adminAccount, txnRequest);
    const committedTxn = await aptosClient.submitTransaction(signedTxn);

    console.log('[admin] Transaction submitted:', committedTxn.hash);

    // Wait for transaction confirmation
    try {
      const executedTransaction = await aptosClient.waitForTransaction(committedTxn.hash);
      console.log('[admin] Transaction confirmed:', JSON.stringify(executedTransaction));
      
      // Check if transaction was successful
      if (executedTransaction && executedTransaction.success === false) {
        throw new Error('Transaction failed on blockchain');
      }
    } catch (waitError) {
      console.error('[admin] Error waiting for transaction:', waitError);
      // Transaction was submitted but we couldn't confirm it immediately
    }

    // Fetch the rejected request details from blockchain
    let requestDetails;
    try {
      const detailsPayload = {
        function: `${MIKO_ADDRESS}::tree_requests::get_request`,
        type_arguments: [],
        arguments: [requestId.toString()]
      };
      const detailsResponse = await aptosClient.view(detailsPayload);
      
      if (detailsResponse && detailsResponse[0] && detailsResponse[0].vec && detailsResponse[0].vec[0]) {
        requestDetails = detailsResponse[0].vec[0];
      }
    } catch (viewError) {
      console.error('[admin] Error fetching request details after rejection:', viewError);
    }

    // Update user stats if found
    if (requestDetails) {
      try {
        const User = (await import('../models/user.model.js')).default;
        const requesterAddress = requestDetails.requester;
        const user = await User.findOne({ 'authMethods.wallets.address': requesterAddress });
        
        if (user) {
          await User.findByIdAndUpdate(user._id, {
            $inc: { 'stats.treesRejected': 1 }
          });
          console.log('[admin] Updated user rejection stats');
        }
      } catch (dbError) {
        console.error('[admin] Error updating user stats:', dbError);
      }
    }

    // Record in verification history
    if (req.admin.adminType === 'VERIFICATION_ADMIN' && req.admin.adminId) {
      try {
        await VerificationAdmin.findByIdAndUpdate(req.admin.adminId, {
          $push: {
            verificationHistory: {
              requestId: requestId,
              action: 'REJECTED',
              timestamp: new Date(),
              cctGranted: 0
            }
          },
          $inc: { 'stats.totalRejected': 1 }
        });
      } catch (err) {
        console.error('[admin] Failed to update verification history:', err);
      }
    }

    res.json({
      success: true,
      message: 'Request rejected on blockchain',
      transactionHash: committedTxn.hash,
      requestId,
      reason,
      explorerUrl: `https://explorer.aptoslabs.com/txn/${committedTxn.hash}?network=devnet`
    });
  } catch (err) {
    console.error('[admin] Reject request error:', err);
    res.status(500).json({ error: 'Failed to reject request: ' + err.message });
  }
});

// Get verification history (for Verification Admin)
router.get('/verification/history', requireVerificationAdmin, async (req, res) => {
  try {
    if (req.admin.adminType === 'SUPER_ADMIN') {
      // Super admin sees all
      const history = await TreeSubmission.find({
        status: { $in: ['APPROVED', 'REJECTED'] }
      })
        .sort({ reviewedAt: -1 })
        .limit(100)
        .select('status reviewedBy reviewedAt cctGranted');

      return res.json({
        history: history.map(h => ({
          id: h._id.toString(),
          action: h.status,
          reviewedBy: h.reviewedBy,
          reviewedAt: h.reviewedAt,
          cctGranted: h.cctGranted
        }))
      });
    }

    // Verification admin sees only their history
    const admin = await VerificationAdmin.findById(req.admin.adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({
      history: admin.verificationHistory.map(h => ({
        requestId: h.requestId.toString(),
        action: h.action,
        timestamp: h.timestamp,
        cctGranted: h.cctGranted
      }))
    });
  } catch (err) {
    console.error('[admin] Verification history error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get all requests with filtering (Super Admin oversight)
router.get('/verification/all-requests', requireSuperAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      TreeSubmission.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'username'),
      TreeSubmission.countDocuments(query)
    ]);

    res.json({
      requests: requests.map(r => ({
        id: r._id.toString(),
        username: r.userId?.username,
        status: r.status,
        location: r.location,
        createdAt: r.createdAt,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        cctGranted: r.cctGranted
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[admin] All requests error:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;
