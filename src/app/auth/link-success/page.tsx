"use client";
import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../components/auth/AuthProvider';

export default function LinkSuccess(){
  const { refresh } = useAuth();
  useEffect(()=>{ void refresh(); },[refresh]);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold mb-3">Linked successfully</h1>
      <p className="text-neutral-300">Your account has been updated.</p>
      <div className="mt-4"><Link href="/profile" className="nav-btn">Back to Profile</Link></div>
    </div>
  );
}
