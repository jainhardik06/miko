'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SuccessClient(){
  const params = useSearchParams();
  const router = useRouter();
  useEffect(()=>{
    const token = params.get('token');
    if(token){
      try { localStorage.setItem('miko_token', token); } catch {}
      router.replace('/');
    } else {
      router.replace('/?auth=missing_token');
    }
  },[params, router]);
  return <div style={{padding:'3rem', textAlign:'center'}}><h1>Signing you in…</h1></div>;
}