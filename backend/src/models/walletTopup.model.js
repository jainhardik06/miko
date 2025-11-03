import mongoose from 'mongoose';

const WalletTopupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['RAZORPAY', 'CRYPTO'], required: true },
  amountPaise: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'], default: 'PENDING', index: true },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  cryptoTxHash: { type: String, index: true },
  expectedCryptoAmount: { type: Number },
  expectedCryptoSymbol: { type: String },
  expectedFromAddress: { type: String },
  depositAddress: { type: String },
  expiresAt: { type: Date },
  metadata: mongoose.Schema.Types.Mixed,
  errorMessage: String
}, { timestamps: true });

WalletTopupSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
WalletTopupSchema.index({ cryptoTxHash: 1 }, { unique: true, sparse: true });

export default mongoose.models.WalletTopup || mongoose.model('WalletTopup', WalletTopupSchema);
