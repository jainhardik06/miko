import { getAptosClient, getHotWalletAccount, getHotWalletAddress } from './hotWallet.js';

const MODULE_ADDRESS = process.env.MIKO_ADDRESS || process.env.NEXT_PUBLIC_MIKO_ADDRESS;
const CCT_TYPE = `${MODULE_ADDRESS}::cct::CCT`;

function ensureModuleAddress() {
  if (!MODULE_ADDRESS) {
    throw new Error('MIKO_ADDRESS / NEXT_PUBLIC_MIKO_ADDRESS not configured');
  }
}

export async function executeMarketplacePurchase({ listingId, amountMicro, buyerAddress }) {
  ensureModuleAddress();
  if (!Number.isInteger(amountMicro) || amountMicro <= 0) {
    throw new Error('Invalid amountMicro for marketplace purchase');
  }
  if (typeof buyerAddress !== 'string' || !buyerAddress.startsWith('0x')) {
    throw new Error('Buyer address must be provided as 0x-prefixed string');
  }

  const client = getAptosClient();
  const account = getHotWalletAccount();

  const buyPayload = {
    type: 'entry_function_payload',
    function: `${MODULE_ADDRESS}::marketplace::buy`,
    type_arguments: [],
    arguments: [String(listingId), String(amountMicro)]
  };

  const txnRequest = await client.generateTransaction(account.address(), buyPayload);
  const signed = await client.signTransaction(account, txnRequest);
  const buyResult = await client.submitTransaction(signed);
  await client.waitForTransactionWithResult(buyResult.hash, { checkSuccess: true });

  const transferPayload = {
    type: 'entry_function_payload',
    function: '0x1::coin::transfer',
    type_arguments: [CCT_TYPE],
    arguments: [buyerAddress, String(amountMicro)]
  };

  const transferRequest = await client.generateTransaction(account.address(), transferPayload);
  const signedTransfer = await client.signTransaction(account, transferRequest);
  const transferResult = await client.submitTransaction(signedTransfer);
  await client.waitForTransactionWithResult(transferResult.hash, { checkSuccess: true });

  return { buyTxHash: buyResult.hash, transferTxHash: transferResult.hash, executor: getHotWalletAddress() };
}
