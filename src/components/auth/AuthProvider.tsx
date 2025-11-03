"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, sendLogout } from '../../lib/authClient';

type AuthRole = 'INDIVIDUAL' | 'CORPORATE' | 'VALIDATOR' | 'ADMIN';

export interface AuthenticatedUser {
  id: string;
  username: string | null;
  role: AuthRole;
}

export interface AuthMethodsSummary {
  google: boolean;
  passwordless: boolean;
  wallets: Array<{ address: string; network: string }>;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  methods: AuthMethodsSummary | null;
  loading: boolean;
  token: string | null;
  loginWithToken: (token: string)=>Promise<void>;
  logout: ()=>Promise<void>;
  refresh: ()=>Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredToken(){
  if(typeof window === 'undefined') return null;
  try { return window.localStorage.getItem('miko_token'); }
  catch { return null; }
}

function writeStoredToken(token: string | null){
  if(typeof window === 'undefined') return;
  try {
    if(token){ window.localStorage.setItem('miko_token', token); }
    else { window.localStorage.removeItem('miko_token'); }
  } catch(err){ console.warn('[auth] failed to persist token', err); }
}

export function AuthProvider({ children }:{ children: React.ReactNode }){
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [methods, setMethods] = useState<AuthMethodsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (incomingToken: string | null)=>{
    if(!incomingToken){
      setUser(null); setMethods(null); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const me = await fetchCurrentUser(incomingToken);
      setUser({ id: me.user.id, username: me.user.username ?? null, role: me.user.role });
      setMethods(me.methods);
    } catch(err){
      console.warn('[auth] failed to load session profile', err);
      setUser(null); setMethods(null);
      writeStoredToken(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  },[]);

  useEffect(()=>{ loadProfile(token); }, [token, loadProfile]);

  useEffect(()=>{
    // Hydration-safe read of persisted token once client mounts
    const stored = readStoredToken();
    if (stored !== null) {
      setToken(stored);
    }
  }, []);

  useEffect(()=>{
    const handler = (e: StorageEvent)=>{
      if(e.key === 'miko_token'){
        setToken(e.newValue ?? null);
      }
    };
    if(typeof window !== 'undefined'){
      window.addEventListener('storage', handler);
      return ()=> window.removeEventListener('storage', handler);
    }
  },[]);

  const loginWithToken = useCallback(async (newToken: string)=>{
    writeStoredToken(newToken);
    setToken(newToken);
    await loadProfile(newToken);
  },[loadProfile]);

  const logout = useCallback(async ()=>{
    const current = readStoredToken();
    if(current){
      try { await sendLogout(current); } catch(err){ console.warn('[auth] logout request failed', err); }
    }
    writeStoredToken(null);
    setToken(null);
    setUser(null);
    setMethods(null);
  },[]);

  const refresh = useCallback(async ()=>{
    await loadProfile(readStoredToken());
  },[loadProfile]);

  useEffect(()=>{
    const handler = (event: Event)=>{
      const custom = event as CustomEvent<{ token?: string | null }>;
      if(typeof custom.detail?.token === 'string'){
        void loginWithToken(custom.detail.token);
      }
      if(custom.detail?.token === null){
        void logout();
      }
    };
    if(typeof window !== 'undefined'){
      window.addEventListener('miko:auth', handler as EventListener);
      return ()=> window.removeEventListener('miko:auth', handler as EventListener);
    }
  },[loginWithToken, logout]);

  const value = useMemo<AuthContextValue>(()=>({
    user,
    methods,
    loading,
    token,
    loginWithToken,
    logout,
    refresh
  }), [user, methods, loading, token, loginWithToken, logout, refresh]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(){
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
