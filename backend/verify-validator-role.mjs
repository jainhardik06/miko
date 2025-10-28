// Verify validator role
import { AptosClient, AptosAccount, HexString } from 'aptos';
import dotenv from 'dotenv';

dotenv.config();

const APTOS_NODE = 'https://fullnode.devnet.aptoslabs.com/v1';
const MIKO_ADDRESS = process.env.MIKO_ADDRESS || process.env.NEXT_PUBLIC_MIKO_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

const client = new AptosClient(APTOS_NODE);

// Create admin account from private key
const privateKeyHex = ADMIN_PRIVATE_KEY.startsWith('0x') 
  ? ADMIN_PRIVATE_KEY.substring(2) 
  : ADMIN_PRIVATE_KEY;
const adminAccount = new AptosAccount(new HexString(privateKeyHex).toUint8Array());

console.log('Checking validator role for:', adminAccount.address().hex());

try {
  // Get the Roles resource
  const resource = await client.getAccountResource(
    MIKO_ADDRESS,
    `${MIKO_ADDRESS}::roles::Roles`
  );
  
  console.log('\nRoles resource:', JSON.stringify(resource.data, null, 2));
  
  const validators = resource.data.validators;
  const isValidator = validators.includes(adminAccount.address().hex());
  
  console.log('\n✅ Admin is validator:', isValidator);
  
  if (!isValidator) {
    console.log('❌ Admin is NOT in validators list!');
    console.log('Current validators:', validators);
  }
} catch (error) {
  console.error('Error:', error.message);
}
