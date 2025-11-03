import { getConfig } from '../config';

const API = getConfig().apiOrigin;

async function authedFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      const data = text ? JSON.parse(text) : {};
      const message = data?.error || res.statusText || 'Request failed';
      throw new Error(message);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== 'Request failed') {
        throw parseErr;
      }
      throw new Error(res.statusText || 'Request failed');
    }
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text as unknown;
  }
}

export async function fetchWalletSummary(token: string) {
  return authedFetch('/api/wallet/balance', token);
}

export async function fetchWalletTransactions(token: string, limit = 25) {
  return authedFetch(`/api/wallet/transactions?limit=${limit}`, token);
}

export async function updateBankDetails(token: string, payload: { accountHolderName: string; accountNumber: string; ifscCode: string; bankName: string; }) {
  return authedFetch('/api/wallet/bank', token, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function createRazorpayWalletTopup(token: string, amount: number) {
  return authedFetch('/api/wallet/topup/razorpay', token, {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
}

export async function createCryptoWalletTopup(token: string, amount: number) {
  return authedFetch('/api/wallet/topup/crypto', token, {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
}

export async function createPurchaseOrder(token: string, payload: { listingId: number; quantityTokens?: number; }) {
  return authedFetch('/api/payments/create-razorpay-order', token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function buyWithMikoWallet(token: string, payload: { listingId: number; quantityTokens?: number; }) {
  return authedFetch('/api/payments/buy-with-wallet', token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
