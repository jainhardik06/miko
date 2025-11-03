import mongoose from 'mongoose';

const WalletTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
  amountPaise: { type: Number, required: true },
  balanceAfterPaise: { type: Number, required: true },
  referenceType: { type: String },
  referenceId: { type: String },
  description: { type: String },
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

WalletTransactionSchema.index({ referenceType: 1, referenceId: 1 });
WalletTransactionSchema.index({ createdAt: -1 });

export default mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', WalletTransactionSchema);
