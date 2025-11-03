import Razorpay from 'razorpay';

let razorpayClient;

export function getRazorpayClient() {
  if (razorpayClient) return razorpayClient;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not configured');
  }
  razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpayClient;
}

export function getPublicRazorpayKey() {
  return process.env.RAZORPAY_KEY_ID || '';
}
