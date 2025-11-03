import axios from 'axios';

export async function fetchAptToInrQuote() {
  const fallback = Number(process.env.APT_FIAT_FALLBACK || '200');
  try {
    const url = process.env.APT_PRICE_URL || 'https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=inr';
    const response = await axios.get(url, { timeout: 4000 });
    const value = response.data?.aptos?.inr;
    if (Number.isFinite(value)) {
      return Number(value);
    }
  } catch (error) {
    console.warn('[pricing] Failed to fetch APT price, using fallback:', error?.message || error);
  }
  return fallback;
}
