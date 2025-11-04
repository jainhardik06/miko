import { AptosClient, AptosAccount, HexString } from 'aptos';

let aptosClient;
let hotWallet;

function getNodeUrl() {
  const url = process.env.APTOS_NODE_URL;
  if (url) return url;
  // Default to devnet fullnode v1 endpoint
  return 'https://fullnode.devnet.aptoslabs.com/v1';
}

export function getAptosClient() {
  if (aptosClient) return aptosClient;
  aptosClient = new AptosClient(getNodeUrl());
  return aptosClient;
}

export function getHotWalletAccount() {
  if (hotWallet) return hotWallet;
  const secret = process.env.FIAT_HOT_WALLET_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
  if (!secret) {
    throw new Error('FIAT_HOT_WALLET_PRIVATE_KEY (or ADMIN_PRIVATE_KEY) not configured');
  }
  try {
    const trimmed = secret.trim();
    const match = trimmed.match(/0x[0-9a-fA-F]+/);
    const hexPortion = match ? match[0] : trimmed;
    const rawHex = hexPortion.startsWith('0x') ? hexPortion.slice(2) : hexPortion;
    if (!/^[0-9a-fA-F]+$/.test(rawHex)) {
      throw new Error('hex string expected');
    }
    const evenHex = rawHex.length % 2 === 1 ? `0${rawHex}` : rawHex;
    const normalized = `0x${evenHex}`;
    const keyBytes = HexString.ensure(normalized).toUint8Array();
    hotWallet = new AptosAccount(keyBytes);
  } catch (error) {
    throw new Error(`Invalid FIAT_HOT_WALLET_PRIVATE_KEY format: ${error?.message || error}`);
  }
  return hotWallet;
}

export function getHotWalletAddress() {
  return getHotWalletAccount().address().hex();
}
