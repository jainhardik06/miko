"use client";
import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { useAdmin } from '@/components/admin/AdminProvider';
import { getDashboardStats, type DashboardStats } from '@/lib/api/admin';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminGuard requireType="ANY">
      <div className="min-h-screen bg-neutral-950">
        <AdminNav />
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white mb-2">Dashboard</h1>
            <p className="text-neutral-400">
              Welcome back, {admin?.username}
              {admin?.adminType === 'SUPER_ADMIN' && ' (Super Admin)'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : stats ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  title="Pending Requests"
                  value={stats.stats.pendingRequests}
                  icon="⏳"
                  color="amber"
                  link="/admin/verification"
                />
                <StatCard
                  title="Approved Trees"
                  value={stats.stats.approvedTrees}
                  icon="✅"
                  color="emerald"
                />
                <StatCard
                  title="Rejected Requests"
                  value={stats.stats.rejectedRequests}
                  icon="❌"
                  color="red"
                />
                <StatCard
                  title="Total Users"
                  value={stats.stats.totalUsers}
                  icon="👥"
                  color="blue"
                />
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    <Link
                      href="/admin/verification"
                      className="flex items-center justify-between p-4 bg-neutral-800/40 hover:bg-neutral-800/60 rounded-lg transition-colors group"
                    >
                      <span className="text-white">Review Pending Requests</span>
                      <svg className="w-5 h-5 text-neutral-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    
                    {admin?.adminType === 'SUPER_ADMIN' && (
                      <Link
                        href="/admin/admins"
                        className="flex items-center justify-between p-4 bg-neutral-800/40 hover:bg-neutral-800/60 rounded-lg transition-colors group"
                      >
                        <span className="text-white">Manage Verification Admins</span>
                        <svg className="w-5 h-5 text-neutral-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                    
                    <Link
                      href="/admin/history"
                      className="flex items-center justify-between p-4 bg-neutral-800/40 hover:bg-neutral-800/60 rounded-lg transition-colors group"
                    >
                      <span className="text-white">View Verification History</span>
                      <svg className="w-5 h-5 text-neutral-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                  <div className="space-y-3">
                    {stats.recentActivity.slice(0, 5).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-lg"
                      >
                        <div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            activity.status === 'APPROVED' 
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : activity.status === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                        <span className="text-xs text-neutral-500">
                          {new Date(activity.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-neutral-400">Failed to load dashboard statistics</p>
            </div>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  link 
}: { 
  title: string; 
  value: number; 
  icon: string; 
  color: 'amber' | 'emerald' | 'red' | 'blue';
  link?: string;
}) {
  const colorClasses = {
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  };

  const content = (
    <div className={`bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-6 ${link ? 'hover:border-emerald-500/30 transition-colors cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
        <div className={`px-3 py-1 rounded-full text-2xl font-bold ${colorClasses[color]}`}>
          {value}
        </div>
      </div>
      <h3 className="text-neutral-400 text-sm font-medium">{title}</h3>
    </div>
  );

  return link ? <Link href={link}>{content}</Link> : content;
}
