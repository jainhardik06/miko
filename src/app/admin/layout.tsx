import { AdminProvider } from '@/components/admin/AdminProvider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}
