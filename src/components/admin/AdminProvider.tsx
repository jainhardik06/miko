"use client";
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAdminProfile, logoutAdmin, type AdminProfile } from '@/lib/api/admin';
import { useRouter } from 'next/navigation';

interface AdminContextValue {
  admin: AdminProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getAdminProfile();
      setAdmin(profile);
    } catch (err) {
      console.warn('[admin] Failed to load profile', err);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const logout = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch (err) {
      console.warn('[admin] Logout error', err);
    }
    setAdmin(null);
    router.push('/admin/login');
  }, [router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadProfile();
  }, [loadProfile]);

  return (
    <AdminContext.Provider value={{ admin, loading, logout, refresh }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return ctx;
}
