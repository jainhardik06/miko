import { Router } from 'express';
import User from '../models/user.model.js';
import Tree from '../models/tree.model.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get user profile with stats
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tree counts
    const [approvedTrees, pendingTrees, rejectedTrees] = await Promise.all([
      Tree.countDocuments({ userId: user._id, status: 'APPROVED' }),
      Tree.countDocuments({ userId: user._id, status: 'PENDING' }),
      Tree.countDocuments({ userId: user._id, status: 'REJECTED' })
    ]);

    res.json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      wallets: user.authMethods?.wallets || [],
      corporateProfile: user.corporateProfile,
      stats: {
        treesApproved: approvedTrees,
        treesPending: pendingTrees,
        treesRejected: rejectedTrees,
        totalCCT: user.stats?.totalCCT || 0
      },
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    });
  } catch (err) {
    console.error('[profile] Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user's trees
router.get('/trees', requireAuth, async (req, res) => {
  try {
    const { status = 'APPROVED', page = 1, limit = 20 } = req.query;
    
    const query = { userId: req.user.userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [trees, total] = await Promise.all([
      Tree.find(query)
        .sort({ mintedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Tree.countDocuments(query)
    ]);

    res.json({
      trees: trees.map(tree => ({
        id: tree._id.toString(),
        blockchainRequestId: tree.blockchainRequestId,
        blockchainTreeId: tree.blockchainTreeId,
        location: tree.location,
        metadataUri: tree.metadataUri,
        cctGranted: tree.cctGranted,
        ratePpm: tree.ratePpm,
        status: tree.status,
        approvedAt: tree.approvedAt,
        mintedAt: tree.mintedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[profile] Trees fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch trees' });
  }
});

router.post('/corporate', requireAuth, async (req,res)=>{
  const { companyName, cin, gstin } = req.body;
  if(!companyName || !cin || !gstin) return res.status(400).json({ error:'All fields required' });
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  user.corporateProfile = {
    companyName, cin, gstin,
    verificationStatus:'PENDING',
    submittedAt:new Date()
  };
  await user.save();
  res.json({ updated:true, corporateProfile:user.corporateProfile });
});

export default router;
