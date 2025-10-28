"use client";
import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { getAllRequests } from '@/lib/api/admin';

interface Request {
  id: string;
  username?: string;
  status: string;
  location: any;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  cctGranted?: number;
}

export default function AllRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getAllRequests(filter || undefined, 1, 100);
      setRequests(data.requests);
    } catch (err) {
      console.error('Failed to load requests', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminGuard requireType="SUPER_ADMIN">
      <div className="min-h-screen bg-neutral-950">
        <AdminNav />
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white mb-2">All Requests</h1>
            <p className="text-neutral-400">
              Complete oversight of all tree verification requests
            </p>
          </div>

          <div className="mb-6 flex gap-2">
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-neutral-800/40 text-neutral-400 hover:text-neutral-200 border border-neutral-700/50'
                }`}
              >
                {status || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Requests Found</h3>
              <p className="text-neutral-400">
                {filter ? `No ${filter.toLowerCase()} requests found.` : 'No requests in the system.'}
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-800/40 border-b border-neutral-800/60">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">ID</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">User</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Location</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">CCT</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Reviewed By</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {requests.map((request) => (
                      <tr key={request.id} className="hover:bg-neutral-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-mono text-neutral-300">
                            {request.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-white">{request.username || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            request.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : request.status === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {request.location?.coordinates 
                              ? `${request.location.coordinates[1].toFixed(2)}, ${request.location.coordinates[0].toFixed(2)}`
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-300">
                            {request.cctGranted ? `${request.cctGranted} CCT` : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {request.reviewedBy || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {new Date(request.createdAt).toLocaleDateString()}
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
