'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../components/auth/AuthProvider';

export default function OnboardClient(){
  const params = useSearchParams();
  const router = useRouter();
  const { openModal, toStage } = useAuth();
  useEffect(()=>{
    const method = params.get('authMethod');
    if(method === 'google'){
      openModal();
      toStage('role');
    } else {
      router.replace('/');
    }
  },[params, openModal, toStage, router]);
  return (
    <div style={{padding:'3rem', textAlign:'center'}}>
      <h1>Complete your profile</h1>
      <p>Choose your role to finish onboarding…</p>
    </div>
  );
}