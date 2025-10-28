import mongoose from 'mongoose';

const TreeSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING','REJECTED','APPROVED'], default: 'PENDING' },
  imageUrl: String, // optional if storing externally
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere', required: true } // [lon, lat]
  },
  phash: String,
  vector: { type: [Number], index: false },
  aiDecision: Object,
  createdAt: { type: Date, default: Date.now },
  reviewedBy: String, // Can be adminId or username
  reviewedAt: Date,
  reviewNotes: String,
  cctGranted: Number // CCT amount granted upon approval
}, { timestamps: true });

export default mongoose.models.TreeSubmission || mongoose.model('TreeSubmission', TreeSubmissionSchema);
