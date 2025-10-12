// Frontend helper functions to talk to backend auth API with richer diagnostics
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:5001';

const DEFAULT_TIMEOUT_MS = 8000;

export interface PendingSignupSnapshot {
  email?: { email: string; verifiedAt?: string };
  wallet?: { address: string; network: string; publicKey?: string; verifiedAt?: string };
  google?: { googleId: string; email?: string; verifiedAt?: string };
  createdAt?: number;
  initialMethod?: string | null;
}

export interface PendingSignupStatus {
  initialMethod?: 'google' | 'wallet' | 'otp' | null;
  has?: {
    email?: boolean;
    wallet?: boolean;
    google?: boolean;
  };
  requirements?: {
    wallet?: boolean;
    email?: boolean;
    google?: boolean;
    emailOrGoogle?: boolean;
  };
}

class NetworkError extends Error {
  status?: number;
  data?: any;
  constructor(message: string, status?: number, data?: any){
    super(message); this.name = 'NetworkError'; this.status = status; this.data = data;
  }
}

async function jsonFetch(path: string, opts: RequestInit = {}) {
  const controller = new AbortController();
  const t = setTimeout(()=> controller.abort(), (opts as any).timeout || DEFAULT_TIMEOUT_MS);
  const url = `${API_ORIGIN}${path}`;
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
      credentials: 'include',
      signal: controller.signal
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw:text }; }
    if(!res.ok){
      throw new NetworkError(data.error || `Request failed (${res.status})`, res.status, data);
    }
    return data;
  } catch(e:any){
    if(e.name === 'AbortError') throw new NetworkError(`Request timed out after ${(opts as any).timeout||DEFAULT_TIMEOUT_MS}ms: ${path}`);
    if(e instanceof NetworkError) throw e;
    throw new NetworkError(`Network error contacting auth API: ${e.message}`);
  } finally {
    clearTimeout(t);
  }
}

export async function checkApiHealth(){
  // Cast to any to pass a custom timeout through to jsonFetch
  try { return await jsonFetch('/api/health', { } as any); }
  catch(e:any){
    console.error('[authClient] Health check failed', e);
    throw e;
  }
}

export async function requestOtp(email: string){
  return jsonFetch('/api/auth/otp/request', { method:'POST', body: JSON.stringify({ email }) });
}
export async function verifyOtp(email:string, code:string, pendingToken?:string){
  const payload:any = { email, code };
  if(pendingToken) payload.pendingToken = pendingToken;
  return jsonFetch('/api/auth/otp/verify', { method:'POST', body: JSON.stringify(payload) });
}
export async function fetchWalletChallenge(){
  return jsonFetch('/api/auth/wallet/challenge');
}
export async function verifyWalletSignature(payload:{ address:string; publicKey:string; signature:string; message:string; fullMessage?:string; network?:string; pendingToken?:string }){
  return jsonFetch('/api/auth/wallet/verify', { method:'POST', body: JSON.stringify(payload) });
}
export async function getPendingSignupStatus(pendingToken:string){
  return jsonFetch('/api/auth/signup/status', { method:'POST', body: JSON.stringify({ pendingToken }) }) as Promise<{ pending: PendingSignupSnapshot | null; status: PendingSignupStatus | null }>;
}
export async function completeSignup(payload:{ pendingToken:string; username:string; role:'INDIVIDUAL'|'CORPORATE'; companyName?:string; cin?:string; gstin?:string; }){
  return jsonFetch('/api/auth/signup/complete', { method:'POST', body: JSON.stringify(payload) });
}

export async function fetchCurrentUser(token:string){
  return jsonFetch('/api/auth/me', { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
}

export async function sendLogout(token:string){
  return jsonFetch('/api/auth/logout', { method:'POST', headers:{ Authorization:`Bearer ${token}` } });
}

export async function submitCorporate(token:string, payload:{ companyName:string; cin:string; gstin:string; }){
  return jsonFetch('/api/profile/corporate', { method:'POST', body: JSON.stringify(payload), headers:{ Authorization:`Bearer ${token}` } });
}

export async function checkUsernameAvailability(username:string){
  return jsonFetch(`/api/auth/username/check?u=${encodeURIComponent(username)}`);
}

export function googleAuthUrl(pendingToken?:string){
  if(pendingToken){
    return `${API_ORIGIN}/api/auth/google?pendingToken=${encodeURIComponent(pendingToken)}`;
  }
  return `${API_ORIGIN}/api/auth/google`;
}

// Profile linking helpers
export async function linkWallet(token:string, payload:{ address:string; network?:string; publicKey?:string }){
  return jsonFetch('/api/auth/link/wallet', { method:'POST', body: JSON.stringify(payload), headers:{ Authorization:`Bearer ${token}` } });
}
export async function linkEmailRequest(token:string, email:string){
  return jsonFetch('/api/auth/link/email/request', { method:'POST', body: JSON.stringify({ email }), headers:{ Authorization:`Bearer ${token}` } });
}
export async function linkEmailVerify(token:string, email:string, code:string){
  return jsonFetch('/api/auth/link/email/verify', { method:'POST', body: JSON.stringify({ email, code }), headers:{ Authorization:`Bearer ${token}` } });
}
export function linkGoogleInitUrl(token:string){
  return `${API_ORIGIN}/api/auth/link/google/init?token=${encodeURIComponent(token)}`;
}
export async function updateCurrentUser(token:string, payload:{ username?:string }){
  return jsonFetch('/api/auth/me', { method:'PATCH', body: JSON.stringify(payload), headers:{ Authorization:`Bearer ${token}` } });
}
export async function deleteAccount(token:string){
  return jsonFetch('/api/auth/me', { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
}
