import crypto from 'crypto';

const DEFAULT_CONTEXT = 'miko:field:v1';

function getKey(secret = process.env.DATA_ENCRYPTION_KEY) {
  if (!secret || !secret.trim()) {
    throw new Error('DATA_ENCRYPTION_KEY missing - required for sensitive field encryption');
  }
  const normalized = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }
  // Derive a 32-byte key from arbitrary secret using SHA-256
  return crypto.createHash('sha256').update(normalized).digest();
}

export function encryptField(value, context = DEFAULT_CONTEXT) {
  if (value === undefined || value === null) return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(context));
  const enc = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptField(payload, context = DEFAULT_CONTEXT) {
  if (!payload) return null;
  const raw = Buffer.from(payload, 'base64');
  if (raw.length < 12 + 16) {
    throw new Error('Encrypted payload too small');
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '';
  const str = String(accountNumber).replace(/\s+/g, '');
  if (str.length <= 4) return str;
  const last4 = str.slice(-4);
  return `**** **${last4}`;
}
