import mongoose from 'mongoose';

const verificationAdminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  passwordHash: {
    type: String,
    required: true
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'super-admin'
  },
  lastLogin: {
    type: Date
  },
  verificationHistory: [{
    requestId: mongoose.Schema.Types.ObjectId,
    action: { type: String, enum: ['APPROVED', 'REJECTED'] },
    timestamp: Date,
    cctGranted: Number
  }],
  stats: {
    totalApproved: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    totalCCTGranted: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index for faster lookups (username already indexed via unique: true)
verificationAdminSchema.index({ isEnabled: 1 });

const VerificationAdmin = mongoose.model('VerificationAdmin', verificationAdminSchema);

export default VerificationAdmin;
