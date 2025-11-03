"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginSuperAdmin, loginVerificationAdmin } from '@/lib/api/admin';
import { useAdmin } from '@/components/admin/AdminProvider';
import Link from 'next/link';

type AdminType = 'super' | 'verification';

export default function AdminLoginPage() {
  const [adminType, setAdminType] = useState<AdminType>('verification');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { refresh } = useAdmin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (adminType === 'super') {
        const result = await loginSuperAdmin(username, password);
        console.log('[Login] Super admin login successful:', result);
      } else {
        const result = await loginVerificationAdmin(username, password);
        console.log('[Login] Verification admin login successful:', result);
      }

      // refresh admin context so guards/dashboards see the authenticated session
      await refresh();
      router.push('/admin/dashboard');
    } catch (err: any) {
      console.error('[Login] Error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-emerald-400 mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800/60 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-white mb-2">Admin Login</h1>
            <p className="text-sm text-neutral-400">
              Access the verification and management panel
            </p>
          </div>

          {/* Admin Type Selector */}
          <div className="flex gap-2 p-1 bg-neutral-800/40 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setAdminType('verification')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                adminType === 'verification'
                  ? 'bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Verification Admin
            </button>
            <button
              type="button"
              onClick={() => setAdminType('super')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                adminType === 'super'
                  ? 'bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/10'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Super Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-neutral-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                adminType === 'super'
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {adminType === 'super' && (
            <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400/80">
                <span className="font-semibold">Super Admin:</span> Credentials are configured in server environment variables.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
