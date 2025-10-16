import mongoose from 'mongoose';

const TreeSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreeSubmission', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere', required: true } // [lon, lat]
  },
  phash: String,
  vector: { type: [Number], index: false },
  mintedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'trees' });

export default mongoose.models.Tree || mongoose.model('Tree', TreeSchema);
