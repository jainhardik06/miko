"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from './AdminProvider';

export function AdminGuard({ 
  children, 
  requireType 
}: { 
  children: React.ReactNode;
  requireType?: 'SUPER_ADMIN' | 'VERIFICATION_ADMIN' | 'ANY';
}) {
  const { admin, loading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !admin) {
      router.push('/admin/login');
    } else if (!loading && admin && requireType && requireType !== 'ANY') {
      if (admin.adminType !== requireType) {
        router.push('/admin');
      }
    }
  }, [admin, loading, requireType, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-neutral-400">Verifying admin session...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  if (requireType && requireType !== 'ANY' && admin.adminType !== requireType) {
    return null;
  }

  return <>{children}</>;
}
