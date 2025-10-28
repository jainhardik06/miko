import { Router } from 'express';
import Tree from '../models/tree.model.js';
import User from '../models/user.model.js';

const router = Router();

// Get all approved trees for marketplace
router.get('/trees', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      minCCT, 
      maxCCT,
      sortBy = 'mintedAt',
      order = 'desc' 
    } = req.query;

    const query = { status: 'APPROVED' };

    // Filter by CCT amount if provided
    if (minCCT || maxCCT) {
      query.cctGranted = {};
      if (minCCT) query.cctGranted.$gte = parseFloat(minCCT);
      if (maxCCT) query.cctGranted.$lte = parseFloat(maxCCT);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [trees, total] = await Promise.all([
      Tree.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'username authMethods.wallets')
        .lean(),
      Tree.countDocuments(query)
    ]);

    res.json({
      trees: trees.map(tree => ({
        id: tree._id.toString(),
        blockchainRequestId: tree.blockchainRequestId,
        blockchainTreeId: tree.blockchainTreeId,
        owner: {
          id: tree.userId?._id?.toString(),
          username: tree.userId?.username,
          walletAddress: tree.userId?.authMethods?.wallets?.[0]?.address
        },
        location: tree.location,
        metadataUri: tree.metadataUri,
        cctGranted: tree.cctGranted,
        ratePpm: tree.ratePpm,
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
    console.error('[marketplace] Trees fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch trees' });
  }
});

// Get single tree details
router.get('/trees/:id', async (req, res) => {
  try {
    const tree = await Tree.findById(req.params.id)
      .populate('userId', 'username email authMethods.wallets createdAt')
      .lean();

    if (!tree) {
      return res.status(404).json({ error: 'Tree not found' });
    }

    res.json({
      id: tree._id.toString(),
      blockchainRequestId: tree.blockchainRequestId,
      blockchainTreeId: tree.blockchainTreeId,
      owner: {
        id: tree.userId?._id?.toString(),
        username: tree.userId?.username,
        email: tree.userId?.email,
        walletAddress: tree.userId?.authMethods?.wallets?.[0]?.address,
        memberSince: tree.userId?.createdAt
      },
      location: tree.location,
      metadataUri: tree.metadataUri,
      cctGranted: tree.cctGranted,
      ratePpm: tree.ratePpm,
      status: tree.status,
      approvedAt: tree.approvedAt,
      approvedBy: tree.approvedBy,
      mintedAt: tree.mintedAt,
      createdAt: tree.createdAt,
      updatedAt: tree.updatedAt
    });
  } catch (err) {
    console.error('[marketplace] Tree details error:', err);
    res.status(500).json({ error: 'Failed to fetch tree details' });
  }
});

// Get marketplace stats
router.get('/stats', async (req, res) => {
  try {
    const [totalTrees, totalCCT, avgCCT] = await Promise.all([
      Tree.countDocuments({ status: 'APPROVED' }),
      Tree.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$cctGranted' } } }
      ]),
      Tree.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, avg: { $avg: '$cctGranted' } } }
      ])
    ]);

    res.json({
      totalTrees,
      totalCCT: totalCCT[0]?.total || 0,
      avgCCT: avgCCT[0]?.avg || 0
    });
  } catch (err) {
    console.error('[marketplace] Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace stats' });
  }
});

export default router;
