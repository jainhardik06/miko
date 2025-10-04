import { Router } from 'express';
import passport from 'passport';
import otpGenerator from 'otp-generator';
import User from '../models/user.model.js';
// Replace in-memory store with Mongo persistence
import { putOtp, verifyOtp } from '../services/otpStore.mongo.js';
import { sendOtpEmail } from '../services/mailer.js';
import { signSession } from '../middleware/auth.js';
import { verifyAptosSignature } from '../utils/walletVerify.js';

const router = Router();

// --- Google OAuth Initiation ---
router.get('/google', passport.authenticate('google', { scope:['profile','email'] }));

// --- Google OAuth Callback ---
router.get('/google/callback', passport.authenticate('google', { session:false, failureRedirect: process.env.CLIENT_ORIGIN + '/auth?error=google' }), async (req,res)=>{
  const u = req.user;
  if(u.isNew){
    // Redirect with prefill parameters for signup
    const params = new URLSearchParams({ authMethod:'google', googleId:u.googleId, email:u.email||'' });
    return res.redirect(`${process.env.CLIENT_ORIGIN}/auth/onboard?${params.toString()}`);
  }
  const token = signSession(u);
  const params = new URLSearchParams({ token });
  res.redirect(`${process.env.CLIENT_ORIGIN}/auth/success?${params.toString()}`);
});

// --- Request OTP (email) ---
router.post('/otp/request', async (req,res)=>{
  const { email } = req.body;
  if(!email) return res.status(400).json({ error:'Email required' });
  const len = parseInt(process.env.OTP_LENGTH||'6',10);
  const code = otpGenerator.generate(len, { upperCaseAlphabets:false, lowerCaseAlphabets:false, specialChars:false });
  try {
    await putOtp(email.toLowerCase(), code, parseInt(process.env.OTP_TTL_MS||'300000',10));
  } catch(e){
    console.error('Persist OTP failed', e);
    return res.status(500).json({ error:'Failed to generate code' });
  }
  // Attempt to send email (non-blocking failure)
  let emailSent = true; let emailError;
  try { await sendOtpEmail(email, code); }
  catch(e){
    emailSent = false; emailError = e.message; console.error('Send OTP error', e);
  }
  // Dev diagnostics: always log code when not production OR explicit flag set
  if(process.env.NODE_ENV !== 'production' || process.env.LOG_OTP_CODES === 'true'){
    console.log(`[otp][dev] ${email.toLowerCase()} -> code=${code}`);
  }
  const payload = { success:true, emailSent };
  if(!emailSent && (process.env.NODE_ENV !== 'production')){
    payload.emailError = emailError;
    if(process.env.RESEND_SANDBOX_FALLBACK === 'true'){
      payload.hint = 'Check logs for fallback attempt. If still failing, verify Resend domain or API key.';
    } else {
      payload.hint = 'Verify domain in Resend or enable RESEND_SANDBOX_FALLBACK=true for dev.';
    }
  }
  if(process.env.OTP_DEV_EXPOSE === 'true'){
    // Expose code in JSON ONLY if explicitly enabled (never enable in prod)
    payload.devCode = code;
  }
  res.json(payload);
});

// --- Verify OTP ---
router.post('/otp/verify', async (req,res)=>{
  const { email, code } = req.body;
  if(!email || !code) return res.status(400).json({ error:'Missing email or code' });
  let ok = false;
  try { ok = await verifyOtp(email.toLowerCase(), code); }
  catch(e){ console.error('OTP verify error', e); return res.status(500).json({ error:'Server error verifying code' }); }
  if(!ok) return res.status(400).json({ error:'Invalid or expired code' });
  let user = await User.findOne({ email: email.toLowerCase() });
  if(user){
    const token = signSession(user);
    return res.json({ login:true, token, user:{ id:user._id, role:user.role } });
  } else {
    return res.json({ login:false, needsSignup:true, prefill:{ email: email.toLowerCase() } });
  }
});

// --- Wallet Challenge (stateless simple nonce) ---
router.get('/wallet/challenge', (req,res)=>{
  // For now simple timestamp nonce. In production, persist and bind to address.
  const nonce = Date.now().toString(36);
  res.json({ nonce, message:`${process.env.WALLET_MESSAGE_PREFIX||'Miko Auth'} :: ${nonce}` });
});

// --- Wallet Verify ---
router.post('/wallet/verify', async (req,res)=>{
  const { address, publicKey, signature, message, fullMessage, network='aptos' } = req.body;
  // Basic presence
  if(!address || !signature || !message) return res.status(400).json({ error:'Missing required fields (address, signature, message)' });
  let sig = signature;
  let pk = publicKey;
  // Attempt normalization: some wallets may return long concatenated buffers or base64
  const salvage = { originalSigLen: sig?.length, originalPkLen: pk?.length };
  if(sig && !sig.startsWith('0x')){
    // If it looks like base64
    if(/^[A-Za-z0-9+/=]+$/.test(sig)){
      try {
        const buf = Buffer.from(sig, 'base64');
        if(buf.length === 64) sig = '0x'+buf.toString('hex');
      } catch {/* ignore */}
    } else if(/^[0-9a-fA-F]+$/.test(sig) && sig.length === 128){
      sig = '0x'+sig; // plain hex without 0x
    }
  }
  // Some wallets might send publicKey with 0x prefix or longer JSON artifact; truncate if hex length > 64 and starts with hex.
  if(pk && pk.startsWith('0x')) pk = pk.slice(2);
  if(pk && /^[0-9a-fA-F]{66,}$/.test(pk) && pk.length > 64){
    // Heuristic: keep first 64 of hex string
    pk = pk.slice(0,64);
    salvage.truncatedPk = true;
  }
  // Log incoming shape (redact long values)
  console.log('[walletVerify][incoming]', {
    address: address.slice(0,12)+'...',
    signaturePrefix: typeof sig === 'string' ? sig.slice(0,10) : typeof sig,
    signatureLength: sig?.length,
    publicKeyLength: pk?.length,
    salvage,
    hasFullMessage: !!fullMessage,
    messagePreview: message.slice(0,50)
  });
  // Validate formats
  if(typeof sig !== 'string' || !/^0x[0-9a-fA-F]+$/.test(sig)){
    return res.status(400).json({ error:'Malformed signature format (expected 0x hex)' });
  }
  const hexBody = sig.slice(2);
  if(hexBody.length !== 128) {
    return res.status(400).json({ error:'Malformed signature length', detail:{ expectedHexChars:128, got:hexBody.length }});
  }
  if(!pk || !/^[0-9a-fA-F]{64}$/.test(pk)){
    return res.status(400).json({ error:'Malformed or missing publicKey (expect 64 hex chars / 32 bytes ed25519)' });
  }
  const valid = verifyAptosSignature({ message, signature: sig, publicKey: pk, fullMessage });
  if(!valid) return res.status(401).json({ error:'Invalid signature' });
  let user = await User.findOne({ 'authMethods.wallets.address': address });
  if(user){
    const token = signSession(user);
    return res.json({ login:true, token, user:{ id:user._id, role:user.role } });
  }
  res.json({ login:false, needsSignup:true, prefill:{ wallet:{ address, publicKey, network } } });
});

// --- Signup ---
router.post('/signup', async (req,res)=>{
  const { username, role='INDIVIDUAL', googleId, email, wallet, method } = req.body;
  if(!username) return res.status(400).json({ error:'Username required' });
  const exists = await User.findOne({ username });
  if(exists) return res.status(400).json({ error:'Username taken' });

  const user = new User({ username, role });
  if(method === 'google' && googleId && email){
    user.email = email.toLowerCase();
    user.authMethods.google = { googleId, email: email.toLowerCase() };
  } else if(method === 'otp' && email){
    user.email = email.toLowerCase();
    user.authMethods.passwordless = { email: email.toLowerCase(), lastLoginAt:new Date() };
  } else if(method === 'wallet' && wallet){
    user.authMethods.wallets = [{ address: wallet.address, network: wallet.network, publicKey: wallet.publicKey }];
  } else {
    return res.status(400).json({ error:'Invalid signup method payload' });
  }
  await user.save();
  if(role === 'CORPORATE'){
    return res.json({ created:true, corporatePending:true, userId:user._id });
  }
  const token = signSession(user);
  res.json({ created:true, token, user:{ id:user._id, role:user.role } });
});

export default router;
