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
  const keyHex = secret.startsWith('0x') ? secret.slice(2) : secret;
  hotWallet = new AptosAccount(new HexString(keyHex).toUint8Array());
  return hotWallet;
}

export function getHotWalletAddress() {
  return getHotWalletAccount().address().hex();
}
