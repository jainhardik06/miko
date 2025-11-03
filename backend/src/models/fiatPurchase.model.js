import mongoose from 'mongoose';

const FiatPurchaseSchema = new mongoose.Schema({
  buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerWalletAddress: { type: String, required: true },
  listingId: { type: Number, required: true },
  amountTokens: { type: Number, required: true },
  amountMicro: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPaise: { type: Number, required: true },
  sellerAddress: { type: String, required: true },
  sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  channel: { type: String, enum: ['RAZORPAY', 'MIKO_WALLET'], required: true },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PAID', 'FULFILLING', 'FULFILLED', 'FAILED'], default: 'PENDING_PAYMENT', index: true },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  fulfillmentTxHash: { type: String },
  transferTxHash: { type: String },
  failureReason: { type: String },
  notes: mongoose.Schema.Types.Mixed,
  events: [{
    type: { type: String },
    detail: mongoose.Schema.Types.Mixed,
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

FiatPurchaseSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });

export default mongoose.models.FiatPurchase || mongoose.model('FiatPurchase', FiatPurchaseSchema);
