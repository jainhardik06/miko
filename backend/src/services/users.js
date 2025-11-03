import mongoose from 'mongoose';
import User from '../models/user.model.js';

export async function ensureUserForWallet(address, session) {
  if (!address) throw new Error('Wallet address required');
  const normalized = address.toLowerCase();
  const query = { 'authMethods.wallets.address': { $regex: new RegExp(`^${normalized}$`, 'i') } };
  let user = await User.findOne(query).session(session || null);
  if (user) return user;
  user = new User({
    role: 'INDIVIDUAL',
    authMethods: {
      wallets: [{ address: normalized, network: 'aptos', addedAt: new Date() }]
    }
  });
  if (session) {
    await user.save({ session });
  } else {
    await user.save();
  }
  return user;
}

export async function requireUserById(id, session) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid user id');
  }
  const user = await User.findById(id).session(session || null);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}
