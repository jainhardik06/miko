// Check admin account and validator role
import { AptosClient, HexString } from 'aptos';
import dotenv from 'dotenv';

dotenv.config();

const APTOS_NODE = 'https://fullnode.devnet.aptoslabs.com/v1';
const MIKO_ADDRESS = process.env.MIKO_ADDRESS || process.env.NEXT_PUBLIC_MIKO_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

const client = new AptosClient(APTOS_NODE);

console.log('Checking admin account...\n');
console.log('MIKO_ADDRESS:', MIKO_ADDRESS);

// Derive admin address from private key
const privateKeyHex = ADMIN_PRIVATE_KEY.startsWith('0x') 
  ? ADMIN_PRIVATE_KEY.substring(2) 
  : ADMIN_PRIVATE_KEY;

console.log('Admin private key (first 10 chars):', ADMIN_PRIVATE_KEY.substring(0, 10) + '...');

// Calculate admin address (this is tricky without the full aptos SDK)
// For now, let's just check if the address from env has validator role

console.log('\nChecking if admin has validator role...\n');

try {
  const viewPayload = {
    function: `${MIKO_ADDRESS}::roles::is_validator`,
    type_arguments: [],
    arguments: [MIKO_ADDRESS]  // Check the MIKO_ADDRESS itself
  };
  
  const result = await client.view(viewPayload);
  console.log('Is MIKO_ADDRESS a validator?', result[0]);
} catch (error) {
  console.error('Error checking validator role:', error.message);
}

// Let's also check the last few transactions
console.log('\n\nChecking recent transaction...');
console.log('Transaction hash from logs: 0x2ee48b501f4a6f29db28a285ab8c9037a0f3c3d5e46729958f3f30295de402f0');

try {
  const txn = await client.getTransactionByHash('0x2ee48b501f4a6f29db28a285ab8c9037a0f3c3d5e46729958f3f30295de402f0');
  console.log('\nTransaction details:', JSON.stringify(txn, null, 2));
} catch (error) {
  console.error('Error fetching transaction:', error.message);
}
