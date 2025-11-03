import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/user.model.js';
import WalletTopup from '../models/walletTopup.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import { getRazorpayClient, getPublicRazorpayKey } from '../services/razorpay.js';
import { paiseFromRupees, presentBankDetails, rupeesFromPaise } from '../services/wallet.js';
import { encryptField } from '../utils/crypto.js';
import { fetchAptToInrQuote } from '../utils/pricing.js';
import { getHotWalletAddress } from '../services/hotWallet.js';

const router = Router();

router.get('/balance', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.userId).lean();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const balancePaise = user.rupeeBalancePaise || 0;
  res.json({
    balancePaise,
    balanceInr: rupeesFromPaise(balancePaise),
    updatedAt: user.rupeeBalanceUpdatedAt,
    bankDetails: presentBankDetails(user.bankDetails),
    wallets: user.authMethods?.wallets || []
  });
});

router.get('/transactions', requireAuth, async (req, res) => {
  const { limit = 25 } = req.query;
  const transactions = await WalletTransaction.find({ userId: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(parseInt(limit, 10) || 25, 100))
    .lean();
  res.json({
    transactions: transactions.map((tx) => ({
      id: tx._id.toString(),
      direction: tx.direction,
      amountPaise: tx.amountPaise,
      balanceAfterPaise: tx.balanceAfterPaise,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      description: tx.description,
      createdAt: tx.createdAt
    }))
  });
});

router.put('/bank', requireAuth, async (req, res) => {
  const { accountHolderName, accountNumber, ifscCode, bankName } = req.body || {};
  if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
    return res.status(400).json({ error: 'All bank fields are required' });
  }
  const trimmedAccount = String(accountNumber).replace(/\s+/g, '');
  if (!/^\d{6,18}$/.test(trimmedAccount)) {
    return res.status(400).json({ error: 'Account number must be 6-18 digits' });
  }
  const formattedIfsc = String(ifscCode).toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formattedIfsc)) {
    return res.status(400).json({ error: 'Invalid IFSC code format' });
  }
  const last4 = trimmedAccount.slice(-4);
  try {
    const encrypted = encryptField(trimmedAccount, `bank:${req.user.userId}`);
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.bankDetails = {
      accountHolderName,
      accountNumberEnc: encrypted,
      accountNumberLast4: last4,
      ifscCode: formattedIfsc,
      bankName,
      updatedAt: new Date()
    };
    await user.save();
    res.json({ bankDetails: presentBankDetails(user.bankDetails) });
  } catch (error) {
    console.error('[wallet] Failed to update bank details', error);
    res.status(500).json({ error: error.message || 'Unable to save bank details' });
  }
});

router.post('/topup/razorpay', requireAuth, async (req, res) => {
  const { amount } = req.body || {};
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }
  const amountPaise = paiseFromRupees(amount);
  if (amountPaise < 5000) {
    return res.status(400).json({ error: 'Minimum top-up is ₹50' });
  }
  const session = await mongoose.startSession();
  let topupDoc;
  try {
    const razorpay = getRazorpayClient();
    await session.withTransaction(async () => {
      topupDoc = await WalletTopup.create([
        {
          userId: req.user.userId,
          type: 'RAZORPAY',
          amountPaise,
          status: 'PENDING'
        }
      ], { session });
    });
    const topup = topupDoc[0];
    const receipt = `topup_${topup._id.toString()}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      payment_capture: 1,
      notes: {
        type: 'wallet_topup',
        topupId: topup._id.toString(),
        userId: req.user.userId
      }
    });
    topup.razorpayOrderId = order.id;
    await topup.save();
    res.json({
      orderId: order.id,
      amountPaise,
      currency: 'INR',
      key: getPublicRazorpayKey(),
      topupId: topup._id.toString()
    });
  } catch (error) {
    console.error('[wallet] Razorpay topup order failed', error);
    if (topupDoc && topupDoc[0]) {
      try {
        await WalletTopup.findByIdAndUpdate(topupDoc[0]._id, { status: 'FAILED', errorMessage: error?.message });
      } catch (innerErr) {
        console.warn('[wallet] Failed to mark topup as failed', innerErr);
      }
    }
    res.status(500).json({ error: error.message || 'Failed to create payment order' });
  } finally {
    session.endSession();
  }
});

router.post('/topup/crypto', requireAuth, async (req, res) => {
  const { amount } = req.body || {};
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be positive number' });
  }
  const amountPaise = paiseFromRupees(amount);
  if (amountPaise < 5000) {
    return res.status(400).json({ error: 'Minimum top-up is ₹50' });
  }
  try {
    const quote = await fetchAptToInrQuote();
    const aptRequired = amount / quote;
    let depositAddress = process.env.FIAT_HOT_WALLET_ADDRESS || process.env.MIKO_ADMIN_DEPOSIT_ADDRESS;
    if (!depositAddress) {
      try {
        depositAddress = getHotWalletAddress();
      } catch (err) {
        console.error('[wallet] Hot wallet address unavailable', err?.message || err);
      }
    }
    if (!depositAddress) {
      return res.status(500).json({ error: 'Deposit address not configured' });
    }
    const topup = await WalletTopup.create({
      userId: req.user.userId,
      type: 'CRYPTO',
      amountPaise,
      status: 'PENDING',
      expectedCryptoAmount: Number(aptRequired.toFixed(6)),
      expectedCryptoSymbol: 'APT',
      depositAddress,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    res.json({
      topupId: topup._id.toString(),
      amountPaise,
      quoteInrPerApt: quote,
      aptRequired: topup.expectedCryptoAmount,
      depositAddress: topup.depositAddress,
      expiresAt: topup.expiresAt
    });
  } catch (error) {
    console.error('[wallet] Crypto topup intent failed', error);
    res.status(500).json({ error: error.message || 'Unable to create crypto top-up intent' });
  }
});

export default router;
