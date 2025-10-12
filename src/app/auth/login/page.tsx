'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  requestOtp,
  verifyOtp,
  fetchWalletChallenge,
  verifyWalletSignature,
  googleAuthUrl
} from '../../../lib/authClient';
import { connectPetra, signMessagePetra } from '../../../lib/petra';
import { useAuth } from '../../../components/auth/AuthProvider';

export const dynamic = 'force-dynamic';

function useEmailValidation(value: string){
  return useMemo(()=> /.+@.+\..+/.test(value.trim()), [value]);
}

export default function LoginPage(){
  const { user, loginWithToken } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

  const emailValid = useEmailValidation(email);

  useEffect(()=>{
    if(user){
      router.replace('/');
    }
  },[user, router]);

  useEffect(()=>{
    if(typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if(status === 'linked_google'){
      setInfo('Google account linked successfully. You can finish signup now.');
    }
  },[]);

  const handleRequestOtp = async ()=>{
    setError(null);
    setInfo(null);
    if(!emailValid){
      setError('Please enter a valid email address.');
      return;
    }
    setRequestingOtp(true);
    try {
      await requestOtp(email.trim());
      setOtpRequested(true);
      setInfo('We sent a 6-digit code to your email.');
    } catch(e:any){
      setError(e.message || 'Failed to send OTP');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async ()=>{
    if(otp.length !== 6){
      setError('Enter the 6-digit code.');
      return;
    }
    setVerifyingOtp(true);
    setError(null);
    try {
  const resp = await verifyOtp(email.trim(), otp.trim());
      if(resp.login && resp.token){
        await loginWithToken(resp.token);
        router.replace('/');
        return;
      }
      if(resp.needsSignup && resp.pendingToken){
        router.replace(`/auth/signup?pending=${encodeURIComponent(resp.pendingToken)}`);
        return;
      }
      setError('Unexpected response from server.');
    } catch(e:any){
      setError(e.data?.error || e.message || 'Verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleWallet = async ()=>{
    setWalletLoading(true);
    setError(null);
    setInfo(null);
    try {
      const account = await connectPetra();
      const { message, nonce } = await fetchWalletChallenge();
      const sigRes = await signMessagePetra(message, nonce);
      const normalized = normalizeSignatureResult(sigRes, account);
      const resp = await verifyWalletSignature({
        address: account.address,
        publicKey: normalized.publicKey,
        signature: normalized.signature,
        message,
        fullMessage: normalized.fullMessage,
        network: 'aptos'
      });
      if(resp.login && resp.token){
        await loginWithToken(resp.token);
        router.replace('/');
        return;
      }
      if(resp.needsSignup && resp.pendingToken){
        router.replace(`/auth/signup?pending=${encodeURIComponent(resp.pendingToken)}`);
        return;
      }
      setError('Unexpected wallet verification response.');
    } catch(e:any){
      setError(e.message || 'Wallet login failed');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleGoogle = ()=>{
    setError(null);
    setInfo(null);
    window.location.href = googleAuthUrl();
  };

  return (
    <div className="pt-12 md:pt-12">
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Access your Miko account</h1>
      <p className="text-neutral-400 mt-2">Sign in with your preferred method. New users will be guided through signup.</p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section className="rounded-2xl border border-neutral-800 p-6">
          <h2 className="text-xl font-medium mb-4">Federated login</h2>
          <button onClick={handleGoogle} className="w-full btn-primary mb-3">Continue with Google</button>
          <button onClick={handleWallet} disabled={walletLoading} className="w-full btn-secondary">
            {walletLoading ? 'Connecting wallet…' : 'Connect Wallet'}
          </button>
          <p className="text-xs text-neutral-500 mt-3">We support Petra wallets on Aptos. You&rsquo;ll sign a message to authenticate.</p>
        </section>

        <section className="rounded-2xl border border-neutral-800 p-6">
          <h2 className="text-xl font-medium mb-4">Email OTP</h2>
          <label className="block text-sm text-neutral-400">Email</label>
          <input
            className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            value={email}
            onChange={(e)=> setEmail(e.target.value)}
            placeholder="name@example.com"
            type="email"
          />
          <button
            className="btn-secondary w-full mt-4"
            onClick={handleRequestOtp}
            disabled={requestingOtp || !emailValid}
          >
            {requestingOtp ? 'Sending…' : otpRequested ? 'Resend code' : 'Send code'}
          </button>
          {otpRequested && (
            <div className="mt-4">
              <label className="block text-sm text-neutral-400">Enter code</label>
              <input
                className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 tracking-[0.4em] text-center text-lg"
                value={otp}
                onChange={(e)=> setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                inputMode="numeric"
                maxLength={6}
              />
              <button
                className="btn-primary w-full mt-3"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.length !== 6}
              >
                {verifyingOtp ? 'Verifying…' : 'Verify & Continue'}
              </button>
            </div>
          )}
        </section>
      </div>

      {(error || info) && (
        <div className="mt-8">
          {error && <div className="rounded-lg border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
          {info && <div className="rounded-lg border border-emerald-600 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300 mt-3">{info}</div>}
        </div>
      )}
    </main>
    </div>
  );
}

function normalizeSignatureResult(sigRes: any, account: { address: string; publicKey?: string }){
  const result: { signature: string; publicKey: string; fullMessage?: string } = {
    signature: '',
    publicKey: account.publicKey || '',
    fullMessage: sigRes?.full?.fullMessage
  };
  const rawSig = sigRes?.signature;
  if(typeof rawSig === 'string' && rawSig.length > 128){
    result.signature = '0x' + rawSig.slice(0,128);
    const candidate = rawSig.slice(128, 192);
    if(candidate) result.publicKey = candidate;
  } else if(typeof rawSig === 'string' && rawSig.length === 128){
    result.signature = '0x' + rawSig;
  } else if(typeof rawSig === 'string'){
    result.signature = rawSig;
  }
  if(result.publicKey?.startsWith?.('0x')){
    result.publicKey = result.publicKey.slice(2);
  }
  if(!result.publicKey && sigRes?.full?.publicKey){
    result.publicKey = sigRes.full.publicKey.startsWith('0x') ? sigRes.full.publicKey.slice(2) : sigRes.full.publicKey;
  }
  if(!result.signature){
    throw new Error('Wallet did not return a signature. Please retry.');
  }
  if(!result.publicKey){
    throw new Error('Wallet did not expose a public key. Update your wallet and try again.');
  }
  return result;
}
