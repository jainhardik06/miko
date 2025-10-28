import axios from 'axios';

const PINATA_BASE = 'https://api.pinata.cloud';

export function getPinataAuthHeaders() {
  const jwt = process.env.PINATA_JWT;
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_SECRET_API_KEY || process.env.PINATA_API_SECRET;
  if (jwt && jwt.trim()) {
    return { Authorization: `Bearer ${jwt.trim()}` };
  }
  if (apiKey && apiSecret) {
    return { pinata_api_key: apiKey, pinata_secret_api_key: apiSecret };
  }
  throw new Error('Pinata credentials missing: set PINATA_JWT or PINATA_API_KEY and PINATA_SECRET_API_KEY');
}

export function makePinataClient() {
  const headers = getPinataAuthHeaders();
  const client = axios.create({ baseURL: PINATA_BASE, headers, timeout: 30000 });
  return client;
}

export function toGatewayUrl(cid) {
  const base = (process.env.PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs').replace(/\/$/, '');
  return `${base}/${cid}`;
}
