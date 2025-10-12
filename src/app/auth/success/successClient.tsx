'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../components/auth/AuthProvider';

export default function SuccessClient(){
  const params = useSearchParams();
  const router = useRouter();
  const { loginWithToken } = useAuth();

  useEffect(()=>{
    const token = params.get('token');
    if(token){
      (async ()=>{
        await loginWithToken(token);
        router.replace('/');
      })();
    } else {
      router.replace('/auth/login?error=missing_token');
    }
  },[params, router, loginWithToken]);

  return <div style={{padding:'3rem', textAlign:'center'}}><h1>Signing you in…</h1></div>;
}