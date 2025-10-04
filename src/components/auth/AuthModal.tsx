"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';
import { useState, useCallback } from 'react';
import { motion as m } from 'framer-motion';
import { CrystalHeartCanvas } from './CrystalHeartCanvas';
import { useEffect, useRef } from 'react';
import { requestOtp, verifyOtp, fetchWalletChallenge, verifyWalletSignature, signup, googleAuthUrl } from '../../lib/authClient';
// Petra-only integration (adapter removed)
import { connectPetra, signMessagePetra } from '../../lib/petra';

const fadeScale = { initial:{ opacity:0, scale:0.95 }, animate:{ opacity:1, scale:1, transition:{ duration:0.35, ease:[0.22,0.84,0.36,1]}}, exit:{ opacity:0, scale:0.95, transition:{ duration:0.25 }}};
const crossFade = { initial:{ opacity:0, x:10 }, animate:{ opacity:1, x:0, transition:{ duration:0.3 }}, exit:{ opacity:0, x:-10, transition:{ duration:0.25 }}};

export function AuthModal(){
  const { open, closeModal, stage } = useAuth();
  const overlayRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(open){
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return ()=>{ document.body.style.overflow = prev; };
    }
  },[open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div ref={overlayRef} className="auth-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={closeModal} />
          <motion.div className="auth-modal" variants={fadeScale} initial="initial" animate="animate" exit="exit" role="dialog" aria-modal="true">
            <div className="auth-grid">
              <div className="auth-left">
                <div className="auth-left-inner">
                  <div className="auth-visual">
                    <CrystalHeartCanvas />
                  </div>
                  <h2 className="auth-tagline">Enter the Atmanirbhar Green Economy.</h2>
                </div>
                <div className="auth-grid-overlay" aria-hidden="true" />
              </div>
              <div className="auth-right">
                <AnimatePresence mode="wait">
                  <motion.div key={stage} variants={crossFade} initial="initial" animate="animate" exit="exit" className="auth-stage-wrapper">
                    {stage === 'entry' && <EntryStage />}
                    {stage === 'otp' && <OtpStage />}
                    {stage === 'role' && <RoleStage />}
                    {stage === 'corporate' && <CorporateStage />}
                  </motion.div>
                </AnimatePresence>
              </div>
              <button onClick={closeModal} aria-label="Close" className="auth-close-btn">✕</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AuthModal;

// ---------------- Stage Components ----------------

function EntryStage(){
  const { toStage, setEmailOrPhone, emailOrPhone } = useAuth();
  // Adapter removed: we track minimal ephemeral state here
  const [petraAccount, setPetraAccount] = useState<{ address:string; publicKey?:string }|null>(null);
  const [touched, setTouched] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const isEmail = /@/.test(emailOrPhone);
  const isValid = isEmail && /.+@.+\..+/.test(emailOrPhone);

  const startGoogle = ()=>{ window.location.href = googleAuthUrl(); };

  const startOtp = async ()=>{
    if(!isValid){ setTouched(true); return; }
    setLoadingOtp(true); setError(null);
    try {
      await requestOtp(emailOrPhone.trim());
      toStage('otp');
    } catch(e:any){ setError(e.message || 'Failed to send code'); }
    finally { setLoadingOtp(false); }
  };

  const handleWallet = async ()=>{
    setWalletLoading(true); setError(null);
    try {
      if(!petraAccount){
        const acc = await connectPetra();
        setPetraAccount(acc);
      }
      const acct = petraAccount || await connectPetra();
      const { message, nonce } = await fetchWalletChallenge();
      const sigRes = await signMessagePetra(message, nonce);
      
      // COMPREHENSIVE LOGGING - capture everything
      console.log('[wallet][RAW] Complete sigRes =', JSON.parse(JSON.stringify(sigRes)));
      console.log('[wallet][RAW] Complete acct =', JSON.parse(JSON.stringify(acct)));
      console.log('[wallet][RAW] sigRes.full =', sigRes.full);
      console.log('[wallet][RAW] sigRes.signature type =', typeof sigRes.signature);
      console.log('[wallet][RAW] sigRes.signature =', sigRes.signature);
      
      const accountType = (acct as any).type;
      
      // Check if this is a Keyless account (Google OAuth-based)
      if (accountType === 'keyless') {
        setError('Keyless accounts (Google-authenticated wallets) are not yet supported. Please use a standard Petra wallet with a regular keypair, or use "Continue with Google" button instead.');
        setWalletLoading(false);
        return;
      }
      
      const rawSig = sigRes.signature;
      
      // Petra returns a combined payload with signature embedded
      // The actual Ed25519 signature is the first 128 hex chars (64 bytes)
      // Format: [signature 64 bytes][publicKey 32 bytes][rest is JWT/metadata]
      let finalSignature = '';
      let publicKeyStr = '';
      
      if (typeof rawSig === 'string' && rawSig.length > 128) {
        // Extract first 128 hex chars as the signature
        finalSignature = '0x' + rawSig.slice(0, 128);
        // Extract next 64 hex chars as the public key (bytes 64-96, or hex chars 128-192)
        publicKeyStr = rawSig.slice(128, 192);
        console.log('[wallet][EXTRACTED] signature:', finalSignature);
        console.log('[wallet][EXTRACTED] publicKey:', publicKeyStr);
      } else if (typeof rawSig === 'string' && rawSig.length === 128) {
        // Already the right size
        finalSignature = '0x' + rawSig;
        publicKeyStr = (acct as any).publicKey || (sigRes.full?.publicKey) || '';
      } else {
        // Fallback for unexpected format
        finalSignature = rawSig;
        publicKeyStr = (acct as any).publicKey || (sigRes.full?.publicKey) || '';
      }
      
      // If still no publicKey, try fetching fresh
      if(!publicKeyStr || publicKeyStr.startsWith('0x1b687474')){  // Detect encoded JWT path
        try {
          const provider:any = (window as any).petra || (window as any).aptos;
          const refreshed = await provider?.account?.();
          if(refreshed?.publicKey && !refreshed.publicKey.startsWith('0x1b687474')) {
            publicKeyStr = refreshed.publicKey;
          }
        } catch {}
      }
      console.log('[wallet][frontend] debug', {
        address: acct.address,
        pubKeyLen: publicKeyStr?.length,
        signatureLen: finalSignature?.length,
        signaturePrefix: finalSignature?.slice(0,10),
        hasFull: !!sigRes.full,
        fullKeys: sigRes.full ? Object.keys(sigRes.full) : []
      });
      if(!publicKeyStr){
        throw new Error('Wallet publicKey not provided by Petra. Ensure latest wallet extension; try reopening wallet.');
      }
      const verifyResp = await verifyWalletSignature({
        address: acct.address,
        publicKey: publicKeyStr,
        signature: finalSignature,
        message,
        fullMessage: sigRes.full?.fullMessage || undefined,
        network: 'aptos'
      });
      if(verifyResp.login){
        localStorage.setItem('miko_token', verifyResp.token);
        window.dispatchEvent(new CustomEvent('miko:auth', { detail:{ token: verifyResp.token }}));
        // close by returning to initial stage or maybe call location reload
        toStage('entry');
      } else if(verifyResp.needsSignup){
        // auto-signup minimal (INDIVIDUAL) using derived username
        const uname = `wallet_${acct.address.slice(2,8)}`;
        const created = await signup({ username: uname, role:'INDIVIDUAL', method:'wallet', wallet: verifyResp.prefill.wallet });
        if(created.token){
          localStorage.setItem('miko_token', created.token);
          window.dispatchEvent(new CustomEvent('miko:auth', { detail:{ token: created.token }}));
        }
        toStage('entry');
      }
    } catch(e:any){ setError(e.message || 'Wallet login failed'); }
    finally { setWalletLoading(false); }
  };

  return (
    <div className="stage-entry">
      <h3 className="auth-title">Create or access your account</h3>
      <div className="auth-option-grid">
        <button className="auth-option-block" onClick={startGoogle} disabled={walletLoading || loadingOtp}>
          <span className="icon" aria-hidden>🔐</span>
          <span>{'Continue with Google'}</span>
        </button>
        <button className="auth-option-block" onClick={handleWallet} disabled={walletLoading || loadingOtp}>
          <span className="icon" aria-hidden>👛</span>
          <span>{walletLoading? 'Connecting…':'Connect Wallet'}</span>
        </button>
        <div className="auth-input-block">
          <label className="auth-input-label">Email</label>
          <input
            value={emailOrPhone}
            onChange={e=>{ setEmailOrPhone(e.target.value); setError(null);} }
            onBlur={()=>setTouched(true)}
            placeholder="you@example.com"
            className="auth-text-input"
            type="email"
            autoComplete="email"
            disabled={walletLoading}
          />
          {touched && !isValid && <p className="auth-error-text">Enter a valid email.</p>}
        </div>
      </div>
      {error && <div className="auth-error-text mt-2">{error}</div>}
      <div className="auth-primary-actions mt-2">
        <button className="btn-primary w-full" disabled={!isValid || loadingOtp || walletLoading} onClick={startOtp}>{loadingOtp? 'Sending…':'Continue with Email'}</button>
      </div>
    </div>
  );
}

function OtpStage(){
  const { toStage, emailOrPhone } = useAuth();
  const inputs = Array.from({ length: 6 });
  const [values, setValues] = useState<string[]>(Array(6).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<HTMLInputElement[]>([]);

  const focusIndex = (idx:number)=>{ const el = refs.current[idx]; if(el) el.focus(); };
  const fullCode = values.join("");
  const isComplete = fullCode.length === 6;

  const handleChange = (v:string, idx:number)=>{
    if(!/^[0-9]?$/.test(v)) return; // numeric only
    const next = [...values]; next[idx] = v; setValues(next); setError(null);
    if(v && idx < 5) focusIndex(idx+1);
  };
  const handleKey = (e:React.KeyboardEvent<HTMLInputElement>, idx:number)=>{
    if(e.key === 'Backspace' && !values[idx] && idx>0){
      const next = [...values]; next[idx-1] = ''; setValues(next); focusIndex(idx-1); e.preventDefault();
    }
    if(e.key === 'ArrowLeft' && idx>0){ focusIndex(idx-1); }
    if(e.key === 'ArrowRight' && idx<5){ focusIndex(idx+1); }
  };
  const handlePaste = (e:React.ClipboardEvent)=>{
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if(text.length){
      const next = text.split('').concat(Array(6-text.length).fill(''));
      setValues(next as string[]);
      if(text.length === 6){
        setTimeout(()=>verify(next.join('')), 80);
      } else {
        focusIndex(Math.min(text.length,5));
      }
      e.preventDefault();
    }
  };
  const verify = async (code:string)=>{
    if(code.length<6) { setError('Enter full code'); return; }
    setSubmitting(true); setError(null);
    try {
      const resp = await verifyOtp(emailOrPhone.trim(), code);
      if(resp.login){
        localStorage.setItem('miko_token', resp.token);
        window.dispatchEvent(new CustomEvent('miko:auth', { detail:{ token: resp.token }}));
        toStage('entry');
      } else if(resp.needsSignup){
        // derive username from email local-part
        const localPart = emailOrPhone.split('@')[0].replace(/[^a-zA-Z0-9_]/g,'').slice(0,16) || 'user';
        const uname = `${localPart}_${Math.random().toString(36).slice(2,6)}`;
        const created = await signup({ username: uname, role:'INDIVIDUAL', method:'otp', email: emailOrPhone.trim() });
        if(created.token){
          localStorage.setItem('miko_token', created.token);
          window.dispatchEvent(new CustomEvent('miko:auth', { detail:{ token: created.token }}));
        }
        toStage('entry');
      } else {
        setError('Unexpected response');
      }
    } catch(e:any){
      setError(e.data?.error || e.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stage-otp">
      <h3 className="auth-title">Verify OTP</h3>
      <p className="auth-subtle">Enter the 6-digit code we sent.</p>
      <div className="otp-grid" onPaste={handlePaste}>{inputs.map((_,i)=>(
        <input
          key={i}
          ref={el=>{ if(el) refs.current[i]=el; }}
          className="otp-box"
          maxLength={1}
          inputMode="numeric"
          value={values[i]}
          onChange={e=>handleChange(e.target.value, i)}
          onKeyDown={e=>handleKey(e,i)}
        />))}
      </div>
      {error && <p className="auth-error-text mt-3">{error}</p>}
      <div className="auth-primary-actions mt-6">
        <button className="btn-primary w-full" disabled={!isComplete || submitting} onClick={()=>verify(fullCode)}>
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </div>
    </div>
  );
}

function RoleStage(){
  const { toStage, setRole, role } = useAuth();
  return (
    <div className="stage-role">
      <h3 className="auth-title">Select Role</h3>
      <div className="role-card-grid">
        <button className={`role-card ${role==='individual'?'is-active':''}`} onClick={()=>{ setRole('individual'); }}>
          <span className="role-icon">🧑</span>
          <span className="role-label">Individual User</span>
        </button>
        <button className={`role-card ${role==='corporate'?'is-active':''}`} onClick={()=>{ setRole('corporate'); }}>
          <span className="role-icon">🏢</span>
          <span className="role-label">Corporate Entity</span>
        </button>
      </div>
      <div className="auth-primary-actions mt-8 flex gap-4">
        {role && (
          <button className="btn-primary flex-1" onClick={()=> role==='corporate'? toStage('corporate') : toStage('entry')}>Continue</button>
        )}
      </div>
    </div>
  );
}

function CorporateStage(){
  const { toStage } = useAuth();
  const [company, setCompany] = useState('');
  const [cin, setCin] = useState('');
  const [gst, setGst] = useState('');
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = ()=>{
    const e:Record<string,string> = {};
    if(company.trim().length < 3) e.company = 'Name too short';
    if(cin && !/^[A-Z]{1}\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(cin)) e.cin = 'Invalid CIN format';
    if(gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}[A-Z\d]{1}$/.test(gst)) e.gst = 'Invalid GSTIN';
    setErrors(e); return e;
  };
  // TODO: integrate signup (if not already) and then call submitCorporate(token,...)
  const submit = async ()=>{
    const e = validate();
    if(Object.keys(e).length) return;
    setSubmitting(true);
    await new Promise(r=>setTimeout(r,1000));
    toStage('entry');
  };
  return (
    <div className="stage-corporate">
      <h3 className="auth-title">Corporate Profile</h3>
      <div className="corp-form-grid">
        <Field label="Company Name" placeholder="Acme Green Ventures" value={company} onChange={setCompany} error={errors.company} />
        <Field label="CIN" placeholder="L12345MH2024PLC123456" tooltip="Corporate Identification Number issued by MCA." value={cin} onChange={v=>setCin(v.toUpperCase())} error={errors.cin} />
        <Field label="GSTIN" placeholder="22AAAAA0000A1Z5" tooltip="Goods & Services Tax Identification Number." value={gst} onChange={v=>setGst(v.toUpperCase())} error={errors.gst} />
      </div>
      <div className="auth-primary-actions mt-6 flex gap-3">
        <button className="btn-secondary flex-1" onClick={()=>toStage('role')} disabled={submitting}>Back</button>
        <button className="btn-primary flex-1" onClick={submit} disabled={submitting}>{submitting? 'Submitting…':'Submit'}</button>
      </div>
    </div>
  );
}

function Field({ label, placeholder, tooltip, value, onChange, error }:{ label:string; placeholder:string; tooltip?:string; value?:string; onChange?:(v:string)=>void; error?:string; }){
  return (
    <div className={`auth-field ${error? 'has-error':''}`}>
      <label className="auth-input-label flex items-center gap-2">{label}{tooltip && <span className="info-tooltip" data-tip={tooltip}>ℹ</span>}</label>
      <input placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className="auth-text-input" />
      {error && <div className="auth-error-text animate-fade-in">{error}</div>}
    </div>
  );
}