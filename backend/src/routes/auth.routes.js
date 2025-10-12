import { Router } from 'express';
import passport from 'passport';
import otpGenerator from 'otp-generator';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
// Replace in-memory store with Mongo persistence
import { putOtp, verifyOtp } from '../services/otpStore.mongo.js';
import { sendOtpEmail } from '../services/mailer.js';
import { signSession } from '../middleware/auth.js';
import { verifyAptosSignature } from '../utils/walletVerify.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const PENDING_TYPE = 'pending_signup';

function sanitizePending(raw){
  if(!raw) return null;
  const clone = { ...raw };
  delete clone.iat; delete clone.exp;
  return clone;
}

function decodePendingToken(token){
  if(!token) throw new Error('Missing pending token');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if(payload?.type !== PENDING_TYPE) throw new Error('Wrong token type');
    return sanitizePending(payload);
  } catch(err){
    const e = new Error('Invalid or expired pending signup token');
    e.code = 'INVALID_PENDING';
    throw e;
  }
}

function issuePendingToken(previous, updates){
  const prev = sanitizePending(previous) || {};
  const next = { ...prev };
  next.type = PENDING_TYPE;
  next.createdAt = prev.createdAt || Date.now();
  if(updates?.initialMethod && !next.initialMethod){
    next.initialMethod = updates.initialMethod;
  }
  if(updates?.email){
    if(next.email && next.email.email !== updates.email.email){
      const err = new Error('Email already captured; cannot change');
      err.code = 'EMAIL_MISMATCH';
      throw err;
    }
    next.email = {
      ...next.email,
      ...updates.email,
      verifiedAt: updates.email.verifiedAt || next.email?.verifiedAt || new Date().toISOString()
    };
  }
  if(updates?.wallet){
    if(next.wallet && next.wallet.address !== updates.wallet.address){
      const err = new Error('Wallet already captured; cannot change');
      err.code = 'WALLET_MISMATCH';
      throw err;
    }
    next.wallet = {
      ...next.wallet,
      ...updates.wallet,
      verifiedAt: updates.wallet.verifiedAt || next.wallet?.verifiedAt || new Date().toISOString()
    };
  }
  if(updates?.google){
    if(next.google && next.google.googleId !== updates.google.googleId){
      const err = new Error('Google account already captured; cannot change');
      err.code = 'GOOGLE_MISMATCH';
      throw err;
    }
    next.google = {
      ...next.google,
      ...updates.google,
      verifiedAt: updates.google.verifiedAt || next.google?.verifiedAt || new Date().toISOString()
    };
  }
  const token = jwt.sign(next, process.env.JWT_SECRET, {
    expiresIn: process.env.PENDING_SIGNUP_EXPIRES || '15m'
  });
  return { token, payload: next };
}

function respondNeedsSignup(res, pendingToken, payload, extra={}){
  const status = derivePendingStatus(payload);
  return res.json({ login:false, needsSignup:true, pendingToken, status, ...extra });
}

function methodSummary(u){
  return {
    google: !!u?.authMethods?.google?.googleId,
    passwordless: !!u?.authMethods?.passwordless?.email,
    wallets: (u?.authMethods?.wallets||[]).map(w=>({ address:w.address, network:w.network }))
  };
}

function derivePendingStatus(payload){
  const has = {
    email: !!payload?.email,
    wallet: !!payload?.wallet,
    google: !!payload?.google
  };
  const initial = payload?.initialMethod || null;
  const requirements = {
    wallet: false,
    email: false,
    google: false,
    emailOrGoogle: false
  };

  if(!has.wallet){
    requirements.wallet = true;
  }

  if(initial === 'google'){
    requirements.wallet = !has.wallet;
  } else if(initial === 'wallet'){
    requirements.emailOrGoogle = !(has.email || has.google);
    if(!has.wallet){
      requirements.wallet = true;
    }
  } else {
    requirements.wallet = !has.wallet;
  }

  return { initialMethod: initial, has, requirements };
}

// --- Username availability ---
router.get('/username/check', async (req,res)=>{
  const u = (req.query.u||'').toString().trim();
  if(!u) return res.status(400).json({ error:'Missing username query param ?u=' });
  if(!/^[a-zA-Z0-9_]{3,30}$/.test(u)) return res.json({ available:false, reason:'INVALID_FORMAT' });
  const exists = await (await import('../models/user.model.js')).default.findOne({ username:u });
  res.json({ available: !exists });
});

// --- Health (simple readiness) ---
router.get('/health', (req,res)=>{ res.json({ ok:true, ts: Date.now() }); });

// --- Google OAuth Initiation ---
router.get('/google', (req,res,next)=>{
  const { pendingToken } = req.query;
  let state;
  if(typeof pendingToken === 'string' && pendingToken){
    state = Buffer.from(JSON.stringify({ pendingToken })).toString('base64url');
  }
  passport.authenticate('google', { scope:['profile','email'], state })(req,res,next);
});

// --- Google OAuth Callback ---
router.get('/google/callback', (req,res,next)=>{
  passport.authenticate('google', { session:false }, async (err, profileLike)=>{
    if(err){
      console.error('[auth][googleCallback] error', err);
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth/login?error=google');
    }
    const rawState = req.query.state;
    let pendingTokenFromState;
    if(typeof rawState === 'string' && rawState){
      try {
        const decoded = JSON.parse(Buffer.from(rawState,'base64url').toString());
        if(typeof decoded?.pendingToken === 'string') pendingTokenFromState = decoded.pendingToken;
      } catch(stateErr){
        console.warn('[auth][googleCallback] failed to parse state', stateErr);
      }
    }
    if(profileLike?.isNew){
      let existingPending = null;
      if(pendingTokenFromState){
        try {
          existingPending = decodePendingToken(pendingTokenFromState);
        } catch(tokenErr){
          console.warn('[auth][googleCallback] invalid pending token in state', tokenErr.message);
          return res.redirect(process.env.CLIENT_ORIGIN + '/auth/signup?error=pending_expired');
        }
      }
      const { token } = issuePendingToken(existingPending, {
        initialMethod: existingPending?.initialMethod || 'google',
        google: {
          googleId: profileLike.googleId,
          email: profileLike.email?.toLowerCase?.()
        }
      });
      const params = new URLSearchParams({ pending: token });
      return res.redirect(`${process.env.CLIENT_ORIGIN}/auth/signup?${params.toString()}`);
    }
    if(pendingTokenFromState){
      console.warn('[auth][googleCallback] pending token present but google account already linked');
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth/signup?error=google_in_use');
    }
    if(!profileLike){
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth/login?error=google_missing');
    }
    const token = signSession(profileLike);
    const params = new URLSearchParams({ token });
    return res.redirect(`${process.env.CLIENT_ORIGIN}/auth/success?${params.toString()}`);
  })(req,res,next);
});

// --- Request OTP (email) ---
router.post('/otp/request', rateLimit({ keyFn: req=> 'otp_req:'+req.ip, max: parseInt(process.env.RATE_LIMIT_OTP_MAX||'10',10), windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS||'60000',10) }), async (req,res)=>{
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
  const { email, code, pendingToken } = req.body;
  if(!email || !code) return res.status(400).json({ error:'Missing email or code' });
  let ok = false;
  try { ok = await verifyOtp(email.toLowerCase(), code); }
  catch(e){ console.error('OTP verify error', e); return res.status(500).json({ error:'Server error verifying code' }); }
  if(!ok) return res.status(400).json({ error:'Invalid or expired code' });
  const normalized = email.toLowerCase();
  let user = await User.findOne({
    $or:[
      { email: normalized },
      { 'authMethods.passwordless.email': normalized },
      { 'authMethods.google.email': normalized }
    ]
  });
  if(user){
    user.lastLoginAt = new Date();
    if(user.authMethods?.passwordless){
      user.authMethods.passwordless.lastLoginAt = new Date();
    }
    await user.save();
    const token = signSession(user);
    return res.json({ login:true, token, user:{ id:user._id, role:user.role, username:user.username }, methods: methodSummary(user) });
  } else {
    let existingPending = null;
    if(pendingToken){
      try { existingPending = decodePendingToken(pendingToken); }
      catch(err){ return res.status(400).json({ error:err.message, code: err.code||'INVALID_PENDING' }); }
    }
    try {
      const { token, payload } = issuePendingToken(existingPending, {
        initialMethod: existingPending?.initialMethod || 'otp',
        email: { email: normalized, verifiedAt: new Date().toISOString() }
      });
      return respondNeedsSignup(res, token, payload, { prefill:{ email: normalized } });
    } catch(err){
      console.error('[auth][otp->pending] failed', err);
      return res.status(400).json({ error: err.message || 'Failed to capture email', code: err.code||'PENDING_ERROR' });
    }
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
  const { address, publicKey, signature, message, fullMessage, network='aptos', pendingToken } = req.body;
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
    user.lastLoginAt = new Date();
    await user.save();
    const token = signSession(user);
    return res.json({ login:true, existingUser:true, token, user:{ id:user._id, role:user.role, username:user.username }, methods: methodSummary(user) });
  }
  let existingPending = null;
  if(pendingToken){
    try {
      existingPending = decodePendingToken(pendingToken);
    } catch(err){
      return res.status(400).json({ error: err.message, code: err.code||'INVALID_PENDING' });
    }
  }
  try {
    const { token, payload } = issuePendingToken(existingPending, {
      initialMethod: existingPending?.initialMethod || 'wallet',
      wallet: { address, network, publicKey, verifiedAt: new Date().toISOString() }
    });
    return respondNeedsSignup(res, token, payload, { prefill:{ wallet:{ address, publicKey, network } } });
  } catch(err){
    console.error('[auth][wallet->pending] failed', err);
    return res.status(400).json({ error: err.message || 'Failed to capture wallet', code: err.code||'PENDING_ERROR' });
  }
});

// --- Link Wallet (authenticated) ---
router.post('/link/wallet', requireAuth, async (req,res)=>{
  const { address, network='aptos', publicKey } = req.body;
  if(!address) return res.status(400).json({ error:'Missing wallet address' });
  const existingHolder = await User.findOne({ 'authMethods.wallets.address': address });
  if(existingHolder && existingHolder._id.toString() !== req.user.userId){
    return res.status(400).json({ error:'Wallet already linked to another user' });
  }
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  const already = (user.authMethods.wallets||[]).find(w=>w.address===address);
  if(!already){
    user.authMethods.wallets.push({ address, network, publicKey });
    await user.save();
  }
  res.json({ linked:true, methods: methodSummary(user) });
});

// --- Current User ---
router.get('/me', requireAuth, async (req,res)=>{
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  res.json({ user:{ id:user._id, username:user.username, role:user.role, email:user.email||null, corporateProfile:user.corporateProfile }, methods: methodSummary(user) });
});

// --- Update current user ---
router.patch('/me', requireAuth, async (req,res)=>{
  const { username } = req.body || {};
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  if(typeof username === 'string'){
    const u = username.trim();
    if(!/^[a-zA-Z0-9_]{3,30}$/.test(u)) return res.status(400).json({ error:'Username must be 3-30 chars [A-Za-z0-9_]' });
    const exists = await User.findOne({ _id:{ $ne: user._id }, username: u });
    if(exists) return res.status(400).json({ error:'Username taken' });
    user.username = u;
  }
  await user.save();
  res.json({ updated:true, user:{ id:user._id, username:user.username, role:user.role } });
});

// --- Delete current account ---
router.delete('/me', requireAuth, async (req,res)=>{
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  await user.deleteOne();
  res.json({ deleted:true });
});

// --- Pending signup status ---
router.post('/signup/status', async (req,res)=>{
  const { pendingToken } = req.body;
  if(!pendingToken) return res.status(400).json({ error:'pendingToken required' });
  try {
    const payload = decodePendingToken(pendingToken);
    const { type, ...rest } = payload;
    const status = derivePendingStatus(rest);
    return res.json({ pending: rest, status });
  } catch(err){
    return res.status(400).json({ error: err.message, code: err.code || 'INVALID_PENDING' });
  }
});

// --- Link Email (request OTP) ---
router.post('/link/email/request', requireAuth, rateLimit({ keyFn: req=> 'link_email_req:'+req.user.userId, max: parseInt(process.env.RATE_LIMIT_LINK_EMAIL_MAX||'5',10), windowMs: parseInt(process.env.RATE_LIMIT_LINK_EMAIL_WINDOW_MS||'600000',10) }), async (req,res)=>{
  const { email } = req.body;
  if(!email) return res.status(400).json({ error:'Email required' });
  const normalized = email.toLowerCase();
  // Prevent linking an email that already belongs to another user
  const other = await User.findOne({ _id: { $ne: req.user.userId }, $or:[ { email: normalized }, { 'authMethods.passwordless.email': normalized }, { 'authMethods.google.email': normalized } ] });
  if(other) return res.status(400).json({ error:'Email already in use' });
  const len = parseInt(process.env.OTP_LENGTH||'6',10);
  const code = otpGenerator.generate(len, { upperCaseAlphabets:false, lowerCaseAlphabets:false, specialChars:false });
  try { await putOtp(normalized, code, parseInt(process.env.OTP_TTL_MS||'300000',10)); }
  catch(e){ console.error('Persist OTP failed', e); return res.status(500).json({ error:'Failed to generate code' }); }
  let emailSent = true; try { await sendOtpEmail(normalized, code); } catch(e){ emailSent=false; }
  res.json({ success:true, emailSent });
});

// --- Link Email (verify OTP) ---
router.post('/link/email/verify', requireAuth, async (req,res)=>{
  const { email, code } = req.body;
  if(!email || !code) return res.status(400).json({ error:'Missing email or code' });
  const normalized = email.toLowerCase();
  const other = await User.findOne({ _id: { $ne: req.user.userId }, $or:[ { email: normalized }, { 'authMethods.passwordless.email': normalized }, { 'authMethods.google.email': normalized } ] });
  if(other) return res.status(400).json({ error:'Email already in use' });
  let ok=false; try { ok = await verifyOtp(normalized, code); } catch(e){ return res.status(500).json({ error:'Server error verifying code' }); }
  if(!ok) return res.status(400).json({ error:'Invalid or expired code' });
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  user.email = user.email || normalized; // set primary email if empty
  if(!user.authMethods.passwordless){ user.authMethods.passwordless = { email: normalized, lastLoginAt:new Date() }; }
  else { user.authMethods.passwordless.email = normalized; }
  await user.save();
  res.json({ linked:true, methods: methodSummary(user) });
});

// --- Methods summary only ---
router.get('/methods', requireAuth, async (req,res)=>{
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  res.json({ methods: methodSummary(user) });
});

// --- Logout (stateless placeholder) ---
router.post('/logout', requireAuth, (req,res)=>{
  // Client should discard token; optionally add to denylist if implementing.
  res.json({ loggedOut:true });
});

// --- Google Linking (init) ---
router.get('/link/google/init', requireAuth, (req,res,next)=>{
  // Encode JWT user id into state to attach on callback
  const state = Buffer.from(JSON.stringify({ link:'google', uid:req.user.userId })).toString('base64url');
  passport.authenticate('google', { scope:['profile','email'], state })(req,res,next);
});

// --- Google Linking Callback ---
router.get('/link/google/callback', (req,res,next)=>{
  passport.authenticate('google', { session:false }, async (err, profileLike)=>{
    if(err) return res.redirect(process.env.CLIENT_ORIGIN + '/auth?error=google_link');
    // Extract state
    const rawState = req.query.state;
    let parsed; try { parsed = JSON.parse(Buffer.from(rawState,'base64url').toString()); } catch {}
    if(!parsed?.uid || parsed.link !== 'google'){
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth?error=bad_state');
    }
    // If existing account matched by googleId already, block linking to different user
    if(!profileLike?.googleId){
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth?error=missing_google_id');
    }
    const existingHolder = await User.findOne({ 'authMethods.google.googleId': profileLike.googleId });
    if(existingHolder && existingHolder._id.toString() !== parsed.uid){
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth?error=google_in_use');
    }
    const user = await User.findById(parsed.uid);
    if(!user){
      return res.redirect(process.env.CLIENT_ORIGIN + '/auth?error=user_not_found');
    }
    if(!user.authMethods.google){
      user.authMethods.google = { googleId: profileLike.googleId, email: profileLike.email };
      if(!user.email) user.email = profileLike.email;
      await user.save();
    }
    return res.redirect(process.env.CLIENT_ORIGIN + '/auth/link-success?provider=google');
  })(req,res,next);
});

// --- Signup ---
router.post('/signup/complete', async (req,res)=>{
  const { pendingToken, username, role='INDIVIDUAL', companyName, gstin, cin } = req.body;
  if(!pendingToken) return res.status(400).json({ error:'pendingToken required' });
  if(!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username)){
    return res.status(400).json({ error:'Username must be 3-30 characters (letters, numbers, underscore).' });
  }
  let pending;
  try {
    pending = decodePendingToken(pendingToken);
  } catch(err){
    return res.status(400).json({ error: err.message, code: err.code || 'INVALID_PENDING' });
  }
  const status = derivePendingStatus(pending);
  if(status.requirements.wallet){
    return res.status(400).json({ error:'Wallet verification required before completing signup', code:'WALLET_REQUIRED' });
  }
  if(pending.initialMethod === 'wallet' && status.requirements.emailOrGoogle){
    return res.status(400).json({ error:'Link either email OTP or Google before completing signup', code:'CONTACT_REQUIRED' });
  }
  if(!pending.wallet?.address){
    return res.status(400).json({ error:'Wallet verification required before completing signup', code:'WALLET_REQUIRED' });
  }
  const normalizedEmail = pending.email?.email?.toLowerCase?.();
  const primaryEmail = normalizedEmail || pending.google?.email?.toLowerCase?.() || null;
  const usernameExists = await User.findOne({ username });
  if(usernameExists){
    return res.status(400).json({ error:'Username taken' });
  }
  else if(primaryEmail){
    const emailInUse = await User.findOne({
      $or:[
        { email: primaryEmail },
        { 'authMethods.passwordless.email': primaryEmail },
        { 'authMethods.google.email': primaryEmail }
      ]
    });
    if(emailInUse){
      return res.status(400).json({ error:'Email already linked to another user', code:'EMAIL_IN_USE' });
    }
  }
  if(normalizedEmail){
    const emailInUse = await User.findOne({
      $or:[
        { email: normalizedEmail },
        { 'authMethods.passwordless.email': normalizedEmail },
        { 'authMethods.google.email': normalizedEmail }
      ]
    });
    if(emailInUse){
      return res.status(400).json({ error:'Email already linked to another user', code:'EMAIL_IN_USE' });
    }
  }
  const walletInUse = await User.findOne({ 'authMethods.wallets.address': pending.wallet.address });
  if(walletInUse){
    return res.status(400).json({ error:'Wallet already linked to another user', code:'WALLET_IN_USE' });
  }
  if(pending.google?.googleId){
    const googleInUse = await User.findOne({ 'authMethods.google.googleId': pending.google.googleId });
    if(googleInUse){
      return res.status(400).json({ error:'Google account already linked to another user', code:'GOOGLE_IN_USE' });
    }
  }
  if(role === 'CORPORATE'){
    if(!companyName || !gstin || !cin){
      return res.status(400).json({ error:'Corporate fields companyName, gstin, cin required for CORPORATE role', code:'CORPORATE_REQUIRED' });
    }
  }
  const authMethods = {
    wallets: [
      {
        address: pending.wallet.address,
        network: pending.wallet.network,
        publicKey: pending.wallet.publicKey,
        addedAt: new Date()
      }
    ]
  };
  if(normalizedEmail){
    authMethods.passwordless = {
      email: normalizedEmail,
      lastLoginAt: new Date()
    };
  }
  if(pending.google){
    authMethods.google = {
      googleId: pending.google.googleId,
      email: pending.google.email?.toLowerCase?.() || normalizedEmail || undefined
    };
  }
  const userData = {
    username,
    role,
    authMethods,
    lastLoginAt: new Date(),
    meta: { signupSource: pending.initialMethod }
  };
  if(primaryEmail){
    userData.email = primaryEmail;
  }
  const user = new User(userData);
  if(role === 'CORPORATE'){
    user.corporateProfile = {
      companyName,
      gstin,
      cin,
      verificationStatus:'PENDING',
      submittedAt:new Date()
    };
  }
  await user.save();
  const token = signSession(user);
  return res.json({ created:true, token, user:{ id:user._id, role:user.role, username:user.username }, methods: methodSummary(user) });
});

export default router;
