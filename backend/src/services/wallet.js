import mongoose from 'mongoose';
import User from '../models/user.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';

export function paiseFromRupees(amountRupees) {
  if (!Number.isFinite(amountRupees)) {
    throw new Error('Invalid rupee amount');
  }
  return Math.round(amountRupees * 100);
}

export function rupeesFromPaise(amountPaise) {
  return (amountPaise || 0) / 100;
}

export async function applyWalletMovement({
  userId,
  direction,
  amountPaise,
  referenceType,
  referenceId,
  description,
  metadata
}, session) {
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new Error('Invalid userId for wallet movement');
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('Wallet movement amount must be positive integer paise');
  }
  if (!['CREDIT', 'DEBIT'].includes(direction)) {
    throw new Error('Wallet movement direction must be CREDIT or DEBIT');
  }
  const delta = direction === 'CREDIT' ? amountPaise : -amountPaise;
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { rupeeBalancePaise: delta },
      rupeeBalanceUpdatedAt: new Date()
    },
    { new: true, session }
  );
  if (!user) {
    throw new Error('User not found while applying wallet movement');
  }
  if (user.rupeeBalancePaise < 0) {
    throw new Error('Wallet balance cannot be negative');
  }
  const [transaction] = await WalletTransaction.create([
    {
      userId,
      direction,
      amountPaise,
      balanceAfterPaise: user.rupeeBalancePaise,
      referenceType,
      referenceId,
      description,
      metadata
    }
  ], { session });
  return { balanceAfterPaise: user.rupeeBalancePaise, transaction };
}

export function presentBankDetails(bankDetails) {
  if (!bankDetails) return null;
  return {
    accountHolderName: bankDetails.accountHolderName,
    bankName: bankDetails.bankName,
    ifscCode: bankDetails.ifscCode,
    accountLast4: bankDetails.accountNumberLast4,
    maskedAccount: bankDetails.accountNumberLast4 ? `**** **${bankDetails.accountNumberLast4}` : undefined,
    updatedAt: bankDetails.updatedAt
  };
}
