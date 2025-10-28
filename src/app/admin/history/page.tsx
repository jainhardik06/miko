"use client";
import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { getVerificationHistory } from '@/lib/api/admin';

interface HistoryItem {
  requestId?: string;
  id?: string;
  action: string;
  reviewedBy?: string;
  reviewedAt?: string;
  timestamp?: string;
  cctGranted: number;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getVerificationHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to load history', err);
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
            <h1 className="text-3xl font-semibold text-white mb-2">Verification History</h1>
            <p className="text-neutral-400">
              Review your past verification decisions
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-xl font-semibold text-white mb-2">No History Yet</h3>
              <p className="text-neutral-400">Your verification decisions will appear here.</p>
            </div>
          ) : (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-800/40 border-b border-neutral-800/60">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Request ID</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Action</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">CCT Granted</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {history.map((item, idx) => (
                      <tr key={item.requestId || item.id || idx} className="hover:bg-neutral-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-mono text-neutral-300">
                            {(item.requestId || item.id || 'N/A').slice(0, 12)}...
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            item.action === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-300">
                            {item.cctGranted} CCT
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {new Date(item.timestamp || item.reviewedAt || '').toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
