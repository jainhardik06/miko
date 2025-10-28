// Quick script to check blockchain status
import { AptosClient } from 'aptos';

const APTOS_NODE = 'https://fullnode.devnet.aptoslabs.com/v1';
const MIKO_ADDRESS = '0x6a6677bb2559869550af7ddf5303810731f4846a29bb3d0423d3ff1a26d78876';

const client = new AptosClient(APTOS_NODE);

console.log('Fetching pending requests from blockchain...\n');

const viewPayload = {
  function: `${MIKO_ADDRESS}::tree_requests::get_all_pending`,
  type_arguments: [],
  arguments: []
};

try {
  const result = await client.view(viewPayload);
  console.log('Pending requests:', JSON.stringify(result, null, 2));
  
  if (result && result[0]) {
    const requests = result[0];
    console.log(`\nTotal pending: ${requests.length}`);
    requests.forEach((r, i) => {
      console.log(`\nRequest ${i}:`);
      console.log(`  ID: ${r.id}`);
      console.log(`  Requester: ${r.requester}`);
      console.log(`  Status: ${r.status} (1=PENDING, 2=APPROVED, 3=REJECTED)`);
      console.log(`  Rate PPM: ${r.rate_ppm}`);
    });
  }
} catch (error) {
  console.error('Error:', error.message);
}

// Also check all requests
console.log('\n\n=== ALL REQUESTS ===\n');

const allViewPayload = {
  function: `${MIKO_ADDRESS}::tree_requests::get_all_requests`,
  type_arguments: [],
  arguments: []
};

try {
  const result = await client.view(allViewPayload);
  console.log('All requests:', JSON.stringify(result, null, 2));
  
  if (result && result[0]) {
    const requests = result[0];
    console.log(`\nTotal requests: ${requests.length}`);
    requests.forEach((r, i) => {
      console.log(`\nRequest ${i}:`);
      console.log(`  ID: ${r.id}`);
      console.log(`  Requester: ${r.requester}`);
      console.log(`  Status: ${r.status} (1=PENDING, 2=APPROVED, 3=REJECTED)`);
      console.log(`  Rate PPM: ${r.rate_ppm}`);
    });
  }
} catch (error) {
  console.error('Error:', error.message);
}
