// Simple Petra (Aptos) wallet integration helpers without adapter packages.
// Assumes browser extension exposes window.petra or window.aptos.

export interface PetraAccount { address: string; publicKey?: string }

function getProvider(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).petra || (window as any).aptos || null;
}

export async function ensurePetra(): Promise<any> {
  const provider = getProvider();
  if (!provider) throw new Error('Petra wallet not detected. Install the Petra extension and reload.');
  return provider;
}

export async function connectPetra(): Promise<PetraAccount> {
  const provider = await ensurePetra();
  await provider.connect?.();
  const acc = await provider.account?.();
  if (!acc?.address) throw new Error('Failed to obtain Petra account');
  return acc;
}

export async function signMessagePetra(message: string, nonce?: string): Promise<{ signature: string; full?: any }> {
  const provider = await ensurePetra();
  const acct = await provider.account?.();
  const args: any = {
    message,
    nonce: nonce || undefined,
    address: acct?.address,
    application: 'Miko',
    chainId: 1 // devnet/testnet differences ignored for simple signature; adjust if required
  };
  const res = await provider.signMessage?.(args);
  if(!res?.signature) throw new Error('Petra did not return a signature');
  return { signature: res.signature, full: res };
}
