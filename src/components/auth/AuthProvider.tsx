"use client";
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type AuthStage = 'entry' | 'otp' | 'role' | 'corporate';

interface AuthContextValue {
  open: boolean;
  stage: AuthStage;
  emailOrPhone: string;
  role: 'individual' | 'corporate' | null;
  openModal: ()=>void;
  closeModal: ()=>void;
  toStage: (s:AuthStage)=>void;
  setEmailOrPhone: (v:string)=>void;
  setRole: (r:'individual'|'corporate')=>void;
}

const AuthContext = createContext<AuthContextValue|undefined>(undefined);

export function AuthProvider({ children }:{ children: React.ReactNode }){
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<AuthStage>('entry');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [role, setRole] = useState<'individual'|'corporate'|null>(null);

  const openModal = useCallback(()=>{ setOpen(true); setStage('entry'); },[]);
  const closeModal = useCallback(()=>{ setOpen(false); },[]);
  const toStage = useCallback((s:AuthStage)=> setStage(s),[]);

  // Close on ESC
  useEffect(()=>{
    function onKey(e:KeyboardEvent){ if(e.key==='Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[]);

  return (
    <AuthContext.Provider value={{ open, stage, emailOrPhone, role, openModal, closeModal, toStage, setEmailOrPhone, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(){
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
