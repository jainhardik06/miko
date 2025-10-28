"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/admin/AdminProvider';

export default function AdminPage() {
  const { admin, loading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!admin) {
        router.push('/admin/login');
      } else {
        router.push('/admin/dashboard');
      }
    }
  }, [admin, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-neutral-400">Redirecting...</p>
      </div>
    </div>
  );
}
