import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { getRazorpayClient, getPublicRazorpayKey } from '../services/razorpay.js';
import WalletTopup from '../models/walletTopup.model.js';
import FiatPurchase from '../models/fiatPurchase.model.js';
import User from '../models/user.model.js';
import { fetchListing, MICRO_UNITS } from '../utils/marketplace.js';
import { applyWalletMovement } from '../services/wallet.js';
import { ensureUserForWallet } from '../services/users.js';
import { executeMarketplacePurchase } from '../services/marketplaceRobot.js';
import { getHotWalletAddress } from '../services/hotWallet.js';

const router = Router();

router.post('/create-razorpay-order', requireAuth, async (req, res) => {
  const { listingId, quantityTokens } = req.body || {};
  if (!Number.isInteger(listingId)) {
    return res.status(400).json({ error: 'listingId must be provided' });
  }
  try {
    let hotWalletAddress;
    try {
      hotWalletAddress = getHotWalletAddress();
    } catch (err) {
      console.error('[payments] Hot wallet not configured', err?.message || err);
      return res.status(500).json({ error: 'Marketplace hot wallet not configured' });
    }
    const listing = await fetchListing(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or already sold' });
    }
    const amountTokens = quantityTokens ? Number(quantityTokens) : listing.remainingTokens;
    if (!Number.isInteger(amountTokens) || amountTokens <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }
    if (amountTokens > listing.remainingTokens) {
      return res.status(400).json({ error: 'Requested quantity exceeds listing availability' });
    }
    const unitPrice = listing.unitPrice;
    const totalPaise = Math.round(amountTokens * unitPrice * 100);
    if (totalPaise <= 0) {
      return res.status(400).json({ error: 'Listing has invalid price' });
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const walletAddress = user.authMethods?.wallets?.[0]?.address;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Link an Aptos wallet before purchasing' });
    }
    const sellerUser = await ensureUserForWallet(listing.seller);
    const amountMicro = amountTokens * MICRO_UNITS;

    const purchase = await FiatPurchase.create({
      buyerUserId: user._id,
      buyerWalletAddress: walletAddress,
      listingId,
      amountTokens,
      amountMicro,
      unitPrice,
      totalPaise,
      sellerAddress: listing.seller,
      sellerUserId: sellerUser._id,
      channel: 'RAZORPAY',
      status: 'PENDING_PAYMENT',
      notes: { snapshot: listing, hotWallet: hotWalletAddress }
    });

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: totalPaise,
      currency: 'INR',
      receipt: `purchase_${purchase._id.toString()}`,
      payment_capture: 1,
      notes: {
        type: 'marketplace_purchase',
        purchaseId: purchase._id.toString(),
        listingId: listingId.toString(),
        buyerUserId: user._id.toString()
      }
    });

    purchase.razorpayOrderId = order.id;
    await purchase.save();

    res.json({
      orderId: order.id,
      key: getPublicRazorpayKey(),
      amountPaise: totalPaise,
      currency: 'INR',
      purchaseId: purchase._id.toString()
    });
  } catch (error) {
    console.error('[payments] Failed to create Razorpay order', error);
    res.status(500).json({ error: error.message || 'Unable to create Razorpay order' });
  }
});

router.post('/buy-with-wallet', requireAuth, async (req, res) => {
  const { listingId, quantityTokens } = req.body || {};
  if (!Number.isInteger(listingId)) {
    return res.status(400).json({ error: 'listingId required' });
  }
  try {
    try {
      getHotWalletAddress();
    } catch (err) {
      console.error('[payments] Hot wallet unavailable', err?.message || err);
      return res.status(500).json({ error: 'Marketplace hot wallet unavailable' });
    }
    const listing = await fetchListing(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const amountTokens = quantityTokens ? Number(quantityTokens) : listing.remainingTokens;
    if (!Number.isInteger(amountTokens) || amountTokens <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }
    if (amountTokens > listing.remainingTokens) {
      return res.status(400).json({ error: 'Listing does not have that many tokens remaining' });
    }
    const amountMicro = amountTokens * MICRO_UNITS;
    const totalPaise = Math.round(amountTokens * listing.unitPrice * 100);
    const buyer = await User.findById(req.user.userId);
    if (!buyer) {
      return res.status(404).json({ error: 'User not found' });
    }
    const walletAddress = buyer.authMethods?.wallets?.[0]?.address;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Link an Aptos wallet before using Miko wallet balance' });
    }
    const sellerUser = await ensureUserForWallet(listing.seller);
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const [purchase] = await FiatPurchase.create([
          {
            buyerUserId: buyer._id,
            buyerWalletAddress: walletAddress,
            listingId,
            amountTokens,
            amountMicro,
            unitPrice: listing.unitPrice,
            totalPaise,
            sellerAddress: listing.seller,
            sellerUserId: sellerUser._id,
            channel: 'MIKO_WALLET',
            status: 'FULFILLING',
            notes: { snapshot: listing }
          }
        ], { session });

        await applyWalletMovement({
          userId: buyer._id,
          direction: 'DEBIT',
          amountPaise: totalPaise,
          referenceType: 'MARKETPLACE_PURCHASE',
          referenceId: purchase._id.toString(),
          description: `Marketplace purchase listing #${listingId}`,
          metadata: { listingId, channel: 'MIKO_WALLET' }
        }, session);

        const robotResult = await executeMarketplacePurchase({
          listingId,
          amountMicro,
          buyerAddress: walletAddress
        });

        purchase.status = 'FULFILLED';
        purchase.fulfillmentTxHash = robotResult.buyTxHash;
        purchase.transferTxHash = robotResult.transferTxHash;
        purchase.events.push({ type: 'fulfilled', detail: robotResult });
        await purchase.save({ session });

        await applyWalletMovement({
          userId: sellerUser._id,
          direction: 'CREDIT',
          amountPaise: totalPaise,
          referenceType: 'MARKETPLACE_SALE',
          referenceId: purchase._id.toString(),
          description: `Fiat credit for listing #${listingId}`,
          metadata: { buyer: buyer._id.toString(), channel: 'MIKO_WALLET' }
        }, session);

        result = {
          purchaseId: purchase._id.toString(),
          buyTxHash: robotResult.buyTxHash,
          transferTxHash: robotResult.transferTxHash
        };
      });
      session.endSession();
      res.json({ success: true, ...result });
    } catch (error) {
      session.endSession();
      console.error('[payments] Wallet purchase failed', error);
      res.status(500).json({ error: error.message || 'Wallet purchase failed' });
    }
  } catch (error) {
    console.error('[payments] Wallet purchase error', error);
    res.status(500).json({ error: error.message || 'Unable to process purchase' });
  }
});

router.post('/webhooks/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.warn('[payments] Razorpay webhook secret missing, rejecting');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (expected !== signature) {
      console.warn('[payments] Invalid Razorpay signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body?.event;
    if (event === 'payment.captured') {
      await handlePaymentCaptured(req.body);
      res.json({ received: true });
    } else {
      res.json({ ignored: event });
    }
  } catch (error) {
    console.error('[payments] Razorpay webhook error', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
});

async function handlePaymentCaptured(payload) {
  const payment = payload?.payload?.payment?.entity;
  if (!payment) {
    console.warn('[payments] payment.captured payload missing payment entity');
    return;
  }
  const orderId = payment.order_id;
  if (!orderId) {
    console.warn('[payments] payment.captured missing order id');
    return;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const topup = await WalletTopup.findOne({ razorpayOrderId: orderId }).session(session);
      if (topup) {
        if (topup.status === 'SUCCEEDED') {
          console.log('[payments] Topup already processed', orderId);
          return;
        }
        topup.status = 'PROCESSING';
        topup.razorpayPaymentId = payment.id;
        topup.razorpaySignature = payload?.signature || null;
        topup.metadata = { payment };
        await topup.save({ session });
        await applyWalletMovement({
          userId: topup.userId,
          direction: 'CREDIT',
          amountPaise: topup.amountPaise,
          referenceType: 'WALLET_TOPUP',
          referenceId: topup._id.toString(),
          description: 'Razorpay wallet top-up',
          metadata: { paymentId: payment.id }
        }, session);
        topup.status = 'SUCCEEDED';
        await topup.save({ session });
        return;
      }

      const purchase = await FiatPurchase.findOne({ razorpayOrderId: orderId }).session(session);
      if (!purchase) {
        console.warn('[payments] No matching topup or purchase for order', orderId);
        return;
      }
      if (['FULFILLED', 'FULFILLING'].includes(purchase.status)) {
        console.log('[payments] Purchase already fulfilling/fulfilled', orderId);
        return;
      }
      purchase.status = 'PAID';
      purchase.razorpayPaymentId = payment.id;
      purchase.events.push({ type: 'payment_captured', detail: payment });
      await purchase.save({ session });
    });
  } finally {
    session.endSession();
  }
  const purchase = await FiatPurchase.findOne({ razorpayOrderId: orderId });
  if (purchase && purchase.status === 'PAID') {
    await processPendingPurchase(purchase._id);
  }
}

async function processPendingPurchase(purchaseId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const purchase = await FiatPurchase.findById(purchaseId).session(session);
      if (!purchase) return;
      if (purchase.status === 'FULFILLED') return;
      if (purchase.status !== 'PAID') {
        console.warn('[payments] Purchase not ready for fulfillment', purchase.status);
        return;
      }
      purchase.status = 'FULFILLING';
      purchase.events.push({ type: 'fulfillment_started', detail: { at: new Date().toISOString() } });
      await purchase.save({ session });

      const listing = await fetchListing(purchase.listingId);
      if (!listing || listing.remainingTokens * MICRO_UNITS < purchase.amountMicro) {
        purchase.status = 'FAILED';
        purchase.failureReason = 'Listing unavailable or insufficient tokens';
        purchase.events.push({ type: 'failed', detail: { reason: purchase.failureReason } });
        await purchase.save({ session });
        throw new Error(purchase.failureReason);
      }

      let sellerUser;
      if (purchase.sellerUserId) {
        sellerUser = await User.findById(purchase.sellerUserId).session(session);
      }
      if (!sellerUser) {
        sellerUser = await ensureUserForWallet(purchase.sellerAddress, session);
        purchase.sellerUserId = sellerUser._id;
      }

      const robotResult = await executeMarketplacePurchase({
        listingId: purchase.listingId,
        amountMicro: purchase.amountMicro,
        buyerAddress: purchase.buyerWalletAddress
      });

      purchase.status = 'FULFILLED';
      purchase.fulfillmentTxHash = robotResult.buyTxHash;
      purchase.transferTxHash = robotResult.transferTxHash;
      purchase.events.push({ type: 'fulfilled', detail: robotResult });
      await purchase.save({ session });

      await applyWalletMovement({
        userId: sellerUser._id,
        direction: 'CREDIT',
        amountPaise: purchase.totalPaise,
        referenceType: 'MARKETPLACE_SALE',
        referenceId: purchase._id.toString(),
        description: `Razorpay fiat sale for listing #${purchase.listingId}`,
        metadata: { channel: 'RAZORPAY', buyer: purchase.buyerUserId.toString() }
      }, session);
    });
  } catch (error) {
    console.error('[payments] Fulfillment failed', error);
    await FiatPurchase.findByIdAndUpdate(purchaseId, {
      status: 'FAILED',
      failureReason: error.message,
      $push: { events: { type: 'failed', detail: { message: error.message }, at: new Date() } }
    });
    throw error;
  } finally {
    session.endSession();
  }
}

export default router;
