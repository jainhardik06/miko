// Simple in-memory OTP store. Replace with Redis for production.
const store = new Map(); // key: identifier (email), value: { otp, expires }

export function putOtp(identifier, otp, ttlMs){
  store.set(identifier, { otp, expires: Date.now() + ttlMs });
}
export function verifyOtp(identifier, code){
  const entry = store.get(identifier);
  if(!entry) return false;
  if(Date.now() > entry.expires) { store.delete(identifier); return false; }
  const ok = entry.otp === code;
  if(ok) store.delete(identifier);
  return ok;
}
export function peekOtp(identifier){ return store.get(identifier); }
