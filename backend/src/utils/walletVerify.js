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
