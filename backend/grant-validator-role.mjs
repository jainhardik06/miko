// Grant validator role to admin account
import { AptosClient, AptosAccount, HexString } from 'aptos';
import dotenv from 'dotenv';

dotenv.config();

const APTOS_NODE = 'https://fullnode.devnet.aptoslabs.com/v1';
const MIKO_ADDRESS = process.env.MIKO_ADDRESS || process.env.NEXT_PUBLIC_MIKO_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

const client = new AptosClient(APTOS_NODE);

console.log('Granting validator role to admin account...\n');

// Create admin account from private key
const privateKeyHex = ADMIN_PRIVATE_KEY.startsWith('0x') 
  ? ADMIN_PRIVATE_KEY.substring(2) 
  : ADMIN_PRIVATE_KEY;
const adminAccount = new AptosAccount(new HexString(privateKeyHex).toUint8Array());

console.log('Admin address:', adminAccount.address().hex());
console.log('MIKO contract:', MIKO_ADDRESS);

// Grant validator role (must be called by admin)
const payload = {
  type: 'entry_function_payload',
  function: `${MIKO_ADDRESS}::roles::add_validator`,
  type_arguments: [],
  arguments: [adminAccount.address().hex()]
};

console.log('\nSubmitting transaction to grant validator role...');

try {
  const txnRequest = await client.generateTransaction(adminAccount.address(), payload);
  const signedTxn = await client.signTransaction(adminAccount, txnRequest);
  const committedTxn = await client.submitTransaction(signedTxn);
  
  console.log('Transaction submitted:', committedTxn.hash);
  console.log('Waiting for confirmation...');
  
  await client.waitForTransaction(committedTxn.hash);
  
  console.log('\n✅ Validator role granted successfully!');
  console.log(`View transaction: https://explorer.aptoslabs.com/txn/${committedTxn.hash}?network=devnet`);
} catch (error) {
  console.error('\n❌ Error:', error.message);
  
  if (error.message.includes('E_NOT_ADMIN')) {
    console.log('\n💡 The account trying to grant validator role must be the admin account.');
    console.log('   Make sure ADMIN_PRIVATE_KEY corresponds to the account that deployed the contract.');
  }
}
