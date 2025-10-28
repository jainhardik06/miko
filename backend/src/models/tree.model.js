import mongoose from 'mongoose';

const TreeSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreeSubmission' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blockchainRequestId: String, // Request ID from blockchain
  blockchainTreeId: String, // Tree NFT ID from blockchain
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere', required: true } // [lon, lat]
  },
  metadataUri: String, // IPFS or other metadata URI
  phash: String,
  vector: { type: [Number], index: false },
  ratePpm: Number, // Carbon credit rate in parts per million
  cctGranted: Number, // CCT amount granted
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.Mixed }, // Can be adminId or username
  mintedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'trees' });

// Indexes for efficient queries
TreeSchema.index({ userId: 1, status: 1 });
TreeSchema.index({ blockchainRequestId: 1 }, { unique: true, sparse: true });
TreeSchema.index({ blockchainTreeId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Tree || mongoose.model('Tree', TreeSchema);
