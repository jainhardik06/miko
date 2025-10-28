"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin } from './AdminProvider';

export function AdminNav() {
  const { admin, logout } = useAdmin();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const navLinks = admin?.adminType === 'SUPER_ADMIN' ? [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/verification', label: 'Verification' },
    { href: '/admin/admins', label: 'Manage Admins' },
    { href: '/admin/requests', label: 'All Requests' },
  ] : [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/verification', label: 'Verification Queue' },
    { href: '/admin/history', label: 'My History' },
  ];

  return (
    <nav className="border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="text-lg font-semibold text-emerald-400">
              Miko Admin
              {admin?.adminType === 'SUPER_ADMIN' && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-normal">
                  Super
                </span>
              )}
            </Link>
            <div className="flex gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-400">
              {admin?.username}
            </span>
            <button
              onClick={logout}
              className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
