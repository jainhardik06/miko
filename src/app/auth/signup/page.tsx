'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  checkUsernameAvailability,
  completeSignup,
  getPendingSignupStatus,
  googleAuthUrl,
  requestOtp,
  verifyOtp,
  fetchWalletChallenge,
  verifyWalletSignature,
  PendingSignupSnapshot,
  PendingSignupStatus
} from '../../../lib/authClient';
import { connectPetra, signMessagePetra } from '../../../lib/petra';
import { useAuth } from '../../../components/auth/AuthProvider';

export const dynamic = 'force-dynamic';

export default function SignupPage(){
  const router = useRouter();
  const { user, loginWithToken } = useAuth();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<PendingSignupSnapshot | null>(null);
  const [status, setStatus] = useState<PendingSignupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');
  const [role, setRole] = useState<'INDIVIDUAL'|'CORPORATE'>('INDIVIDUAL');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [cin, setCin] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  useEffect(()=>{
    if(user){
      router.replace('/');
    }
  },[user, router]);

  useEffect(()=>{
    if(typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if(err === 'pending_expired'){
      setError('Your signup session expired. Start again.');
    } else if(err === 'google_in_use'){
      setError('That Google account is already linked elsewhere. Use a different Google account or login.');
    }
    const token = params.get('pending');
    if(token){
      void refreshPending(token);
    } else {
      setLoading(false);
      setError(prev => prev || 'Signup session not found. Start from login again.');
    }
  },[]);

  const refreshPending = async (token:string)=>{
    if(!token){
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getPendingSignupStatus(token);
      setPendingToken(token);
      setSummary(res.pending);
      setStatus(res.status || null);
      if(res.pending?.email?.email){
        setOtpEmail(res.pending.email.email);
      }
      if(res.status?.has?.email){
        setOtpRequested(false);
        setOtpCode('');
      }
      setError(null);
    } catch(e:any){
      setError(e.data?.error || e.message || 'Unable to load signup session');
    } finally {
      setLoading(false);
    }
  };

  const emailFromSummary = summary?.email?.email || otpEmail;
  const walletFromSummary = summary?.wallet?.address;
  const googleLinked = !!status?.has?.google;
  const emailVerified = !!status?.has?.email;
  const walletLinked = !!status?.has?.wallet;

  const requiresWallet = !!status?.requirements?.wallet;
  const requiresEmailOrGoogle = !!status?.requirements?.emailOrGoogle;
  const emailRequirementActive = requiresEmailOrGoogle && !googleLinked;
  const googleRequirementActive = requiresEmailOrGoogle && !emailVerified;
  const profileUnlocked = !!status && !requiresWallet && !requiresEmailOrGoogle;

  const emailValid = useMemo(()=> /.+@.+\..+/.test(otpEmail.trim()), [otpEmail]);
  const usernameValid = useMemo(()=> /^[a-zA-Z0-9_]{3,30}$/.test(username.trim()), [username]);
  const corporateRequired = role === 'CORPORATE';

  useEffect(()=>{
    if(!profileUnlocked){
      setUsernameStatus('idle');
      return;
    }
    if(usernameValid){
      (async ()=>{
        setUsernameStatus('checking');
        try {
          const res = await checkUsernameAvailability(username.trim());
          setUsernameStatus(res.available ? 'available' : 'taken');
        } catch {
          setUsernameStatus('idle');
        }
      })();
    } else if(username.length){
      setUsernameStatus('idle');
    }
  },[profileUnlocked, username, usernameValid]);

  const requirementMessage = useMemo(()=>{
    if(!status) return null;
    if(requiresWallet){
      return status.initialMethod === 'google'
        ? 'Your Google account is linked. Connect your wallet to continue.'
        : 'Link your wallet to continue signup.';
    }
    if(requiresEmailOrGoogle){
      return 'Choose one: verify your email via OTP or link a Google account to continue.';
    }
    return 'All required verifications are complete. Finish your profile to create your account.';
  },[status, requiresWallet, requiresEmailOrGoogle]);

  const requestSignupOtp = async ()=>{
    if(emailVerified){
      setError('Email already verified.');
      return;
    }
    if(!emailValid || !pendingToken){
      setError('Enter a valid email before requesting OTP.');
      return;
    }
    setOtpLoading(true);
    setError(null);
    try {
      await requestOtp(otpEmail.trim());
      setOtpRequested(true);
      setPendingMessage('We sent a code to verify your email.');
    } catch(e:any){
      setError(e.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifySignupOtp = async ()=>{
    if(!pendingToken){
      setError('Signup session missing.');
      return;
    }
    if(emailVerified){
      setError('Email already verified.');
      return;
    }
    if(otpCode.trim().length !== 6){
      setError('Enter the 6-digit code.');
      return;
    }
    setOtpVerifying(true);
    setError(null);
    try {
      const res = await verifyOtp(otpEmail.trim(), otpCode.trim(), pendingToken);
      if(res.pendingToken){
        await refreshPending(res.pendingToken);
        setPendingMessage('Email verified successfully.');
        setOtpCode('');
      } else if(res.token){
        await loginWithToken(res.token);
        router.replace('/');
      }
    } catch(e:any){
      setError(e.data?.error || e.message || 'Failed to verify OTP');
    } finally {
      setOtpVerifying(false);
    }
  };

  const linkWallet = async ()=>{
    if(walletLinked){
      setError('Wallet already linked for this signup.');
      return;
    }
    if(!pendingToken){
      setError('Signup session missing.');
      return;
    }
    setWalletLoading(true);
    setError(null);
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
        network: 'aptos',
        pendingToken
      });
      if(resp.pendingToken){
        await refreshPending(resp.pendingToken);
        setPendingMessage('Wallet linked successfully.');
      } else if(resp.token){
        await loginWithToken(resp.token);
        router.replace('/');
      }
    } catch(e:any){
      setError(e.message || 'Failed to link wallet');
    } finally {
      setWalletLoading(false);
    }
  };

  const startGoogleLink = ()=>{
    if(!pendingToken){
      setError('Signup session missing.');
      return;
    }
    window.location.href = googleAuthUrl(pendingToken);
  };

  const canSubmit = profileUnlocked && usernameValid && usernameStatus === 'available' && (!corporateRequired || (companyName && gstin && cin));

  const submit = async ()=>{
    if(!pendingToken){
      setError('Signup session missing.');
      return;
    }
    if(!canSubmit){
      setError('Complete all required steps first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await completeSignup({
        pendingToken,
        username: username.trim(),
        role,
        companyName: role === 'CORPORATE' ? companyName.trim() : undefined,
        gstin: role === 'CORPORATE' ? gstin.trim().toUpperCase() : undefined,
        cin: role === 'CORPORATE' ? cin.trim().toUpperCase() : undefined
      });
      if(res.token){
        await loginWithToken(res.token);
        router.replace('/');
      }
    } catch(e:any){
      setError(e.data?.error || e.message || 'Failed to finish signup');
    } finally {
      setSubmitting(false);
    }
  };

  if(loading){
    return <div className="px-6 py-16 text-center text-neutral-400">Loading signup session…</div>;
  }

  if(!pendingToken){
    return (
      <div className="px-6 py-16 text-center text-neutral-400">
        <p>We couldn&rsquo;t find an active signup session. Please <a href="/auth/login" className="text-emerald-400 underline">start again</a>.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Complete your signup</h1>
      <p className="text-neutral-400 mt-2">Link all required credentials and set up your profile.</p>

      {error && <div className="mt-6 rounded-lg border border-red-600 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
      {pendingMessage && (
        <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">{pendingMessage}</div>
      )}

      <section className="mt-8">
        {requirementMessage && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300">
            {requirementMessage}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-800 p-6">
          <h2 className="text-xl font-medium flex items-center justify-between">
            Email verification
            {emailVerified
              ? <span className="text-emerald-400 text-sm">Verified</span>
              : emailRequirementActive
                ? <span className="text-orange-400 text-sm">Required (choose one)</span>
                : <span className="text-neutral-500 text-sm">Optional</span>}
          </h2>
          <p className="text-sm text-neutral-500 mt-2">We use email for account recovery and notifications.</p>
          <label className="block text-sm text-neutral-400 mt-4">Email</label>
          <input
            className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
            value={otpEmail}
            onChange={(e)=> setOtpEmail(e.target.value)}
            disabled={emailVerified}
            placeholder="name@example.com"
            type="email"
          />
          {!emailVerified && (
            <>
              <button className="btn-secondary w-full mt-4" onClick={requestSignupOtp} disabled={otpLoading || !emailValid}>
                {otpLoading ? 'Sending…' : otpRequested ? 'Resend code' : 'Send OTP'}
              </button>
              {otpRequested && (
                <div className="mt-4">
                  <label className="block text-sm text-neutral-400">OTP Code</label>
                  <input
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 tracking-[0.4em] text-center text-lg"
                    value={otpCode}
                    onChange={(e)=> setOtpCode(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <button className="btn-primary w-full mt-3" onClick={verifySignupOtp} disabled={otpVerifying || otpCode.length!==6}>
                    {otpVerifying ? 'Verifying…' : 'Verify email'}
                  </button>
                </div>
              )}
            </>
          )}
          {emailVerified && (
            <p className="text-xs text-neutral-500 mt-3">Verified as {emailFromSummary}.</p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-800 p-6">
          <h2 className="text-xl font-medium flex items-center justify-between">
            Wallet linking
            {walletLinked
              ? <span className="text-emerald-400 text-sm">Linked</span>
              : requiresWallet
                ? <span className="text-orange-400 text-sm">Required</span>
                : <span className="text-neutral-500 text-sm">Optional</span>}
          </h2>
          <p className="text-sm text-neutral-500 mt-2">Sign a message with Petra to bind your wallet to this account.</p>
          {walletFromSummary && (
            <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
              Connected wallet: <span className="font-mono">{walletFromSummary.slice(0,6)}…{walletFromSummary.slice(-4)}</span>
            </div>
          )}
          {!walletLinked && (
            <button className="btn-primary w-full mt-5" onClick={linkWallet} disabled={walletLoading}>
              {walletLoading ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-800 p-6">
        <h2 className="text-xl font-medium flex items-center justify-between">
          Google account
          {googleLinked
            ? <span className="text-emerald-400 text-sm">Linked</span>
            : googleRequirementActive
              ? <span className="text-orange-400 text-sm">Required (choose one)</span>
              : <span className="text-neutral-500 text-sm">Optional</span>}
        </h2>
        <p className="text-sm text-neutral-500 mt-2">Linking Google lets you login with a single click.</p>
        <button className="btn-secondary mt-4" onClick={startGoogleLink} disabled={!pendingToken}>
          {googleLinked ? 'Switch Google account' : 'Link Google account'}
        </button>
        {googleLinked && (
          <p className="text-xs text-neutral-500 mt-3">Linked as {summary?.google?.email || 'Google user'}.</p>
        )}
        {googleRequirementActive && !googleLinked && (
          <p className="text-xs text-neutral-500 mt-3">Alternatively, verify your email with an OTP.</p>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-neutral-800 p-6">
        <h2 className="text-xl font-medium">Profile</h2>
        {!profileUnlocked ? (
          <p className="text-sm text-neutral-500 mt-3">Complete the required verification steps above to unlock profile setup.</p>
        ) : (
          <>
            <label className="block text-sm text-neutral-400 mt-4">Choose a username</label>
            <input
              className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
              value={username}
              onChange={(e)=> setUsername(e.target.value)}
              placeholder="friendly_name"
            />
            <p className="text-xs mt-1 text-neutral-500">
              {usernameStatus === 'checking' && 'Checking availability…'}
              {usernameStatus === 'available' && <span className="text-emerald-400">Username available!</span>}
              {usernameStatus === 'taken' && <span className="text-red-400">Username already taken.</span>}
              {usernameStatus === 'idle' && 'Use 3-30 characters (letters, numbers, underscore).'}
            </p>

            <div className="mt-6">
              <p className="text-sm text-neutral-400">Account type</p>
              <div className="mt-3 flex gap-3">
                <button
                  className={`flex-1 rounded-lg border px-4 py-3 text-left ${role==='INDIVIDUAL' ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-800'}`}
                  onClick={()=> setRole('INDIVIDUAL')}
                >
                  <span className="block text-sm font-medium">Individual</span>
                  <span className="text-xs text-neutral-500">Personal use, farmers, and validators.</span>
                </button>
                <button
                  className={`flex-1 rounded-lg border px-4 py-3 text-left ${role==='CORPORATE' ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-800'}`}
                  onClick={()=> setRole('CORPORATE')}
                >
                  <span className="block text-sm font-medium">Company</span>
                  <span className="text-xs text-neutral-500">Requires business verification.</span>
                </button>
              </div>
            </div>

            {corporateRequired && (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="Acme Green Ventures" />
                <Field label="GSTIN" value={gstin} onChange={(v)=> setGstin(v.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
                <Field label="CIN" value={cin} onChange={(v)=> setCin(v.toUpperCase())} placeholder="L12345MH2024PLC123456" />
              </div>
            )}

            <button className="btn-primary mt-8" onClick={submit} disabled={!canSubmit || submitting}>
              {submitting ? 'Creating account…' : 'Finish signup'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }:{ label:string; value:string; onChange:(v:string)=>void; placeholder:string; }){
  return (
    <label className="block text-sm text-neutral-400">
      {label}
      <input
        className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2"
        value={value}
        onChange={(e)=> onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
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
