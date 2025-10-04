import crypto from 'crypto';
import Otp from '../models/otp.model.js';

function hash(code, salt){
  return crypto.createHash('sha256').update(code + ':' + salt).digest('hex');
}

export async function putOtp(identifier, code, ttlMs){
  const salt = crypto.randomBytes(8).toString('hex');
  const codeHash = hash(code, salt);
  const expiresAt = new Date(Date.now() + ttlMs);
  // Remove previous active codes for this identifier to avoid clutter.
  await Otp.deleteMany({ identifier, consumedAt: null });
  await Otp.create({ identifier, codeHash, salt, expiresAt });
}

export async function verifyOtp(identifier, code){
  const rec = await Otp.findOne({ identifier, consumedAt:null, expiresAt: { $gt: new Date() } });
  if(!rec) return false;
  if(rec.attempts >= rec.maxAttempts){
    return false;
  }
  const candidate = hash(code, rec.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(candidate,'hex'), Buffer.from(rec.codeHash,'hex'));
  rec.attempts += 1;
  if(ok){
    rec.consumedAt = new Date();
  }
  await rec.save();
  return ok;
}

export async function purgeExpired(){
  await Otp.deleteMany({ $or:[ { expiresAt: { $lte: new Date() } }, { consumedAt: { $ne: null } } ] });
}
