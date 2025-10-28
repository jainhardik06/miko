import nacl from 'tweetnacl';
import { HexString } from 'aptos';

// Petra signMessage typically signs the raw message string provided.
// Some wallets prepend/append domain tags. We accept either the provided
// message or an optional fullMessage if the client sends it in future.
// Signature may be hex (possibly 0x prefixed) or base64.
export function verifyAptosSignature({ message, signature, publicKey, fullMessage }) {
  try {
    if(!signature || !publicKey || !message) return false;
    // Normalize hex inputs
    let sig = signature.startsWith('0x') ? signature.slice(2) : signature;
    let pkHex = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
    // Handle accidental 130-char (65 byte) signatures -> drop first 2 hex chars (recovery/style artifact)
    if(sig.length === 130){
      console.log('[walletVerify] Detected 65-byte signature (130 hex). Normalizing to 64 bytes.');
      sig = sig.slice(2); // heuristic: discard first byte
    }
    if(sig.length !== 128){
      console.warn('[walletVerify] Malformed signature length after normalization', sig.length);
      return false;
    }
    if(pkHex.length !== 64){
      console.warn('[walletVerify] Malformed publicKey length', pkHex.length);
      return false;
    }
    const pk = new HexString(pkHex).toUint8Array();
    const sigBuf = Buffer.from(sig, 'hex');
    const candidates = fullMessage && fullMessage !== message ? [fullMessage, message] : [message];
    for(const candidate of candidates){
      const bytes = new TextEncoder().encode(candidate);
      if(nacl.sign.detached.verify(bytes, sigBuf, pk)) return true;
    }
    return false;
  } catch(e){
    console.error('[walletVerify] Exception verifying signature', e);
    return false;
  }
}

// Placeholder for EVM verification if added later using ethers.utils.verifyMessage


// Do you want to submit a transaction for a range of [1256100 - 1884100] Octas at a gas unit price of 100 Octas? [yes/no] >
// yes
// Transaction submitted: https://explorer.aptoslabs.com/txn/0x967217cacc29023d41f9639e64b3699e9e2a5a15fc9c0383d12f4aec734ef969?network=devnet
// {
//   "Result": {
//     "transaction_hash": "0x967217cacc29023d41f9639e64b3699e9e2a5a15fc9c0383d12f4aec734ef969",
//     "gas_used": 12561,
//     "gas_unit_price": 100,
//     "sender": "6a6677bb2559869550af7ddf5303810731f4846a29bb3d0423d3ff1a26d78876",
//     "sequence_number": 0,
//     "replay_protector": {
//       "SequenceNumber": 0
//     },
//     "success": true,
//     "timestamp_us": 1761151810400250,
//     "version": 202469249,
//     "vm_status": "Executed successfully"
//   }
// }
// PS D:\miko\miko\move>