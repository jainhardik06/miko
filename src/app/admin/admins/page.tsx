"use client";
import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { 
  getVerificationAdmins, 
  createVerificationAdmin, 
  updateVerificationAdmin,
  deleteVerificationAdmin,
  type VerificationAdmin 
} from '@/lib/api/admin';
import { useToast } from '@/components/ToastProvider';

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<VerificationAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedAdmin, setSelectedAdmin] = useState<VerificationAdmin | null>(null);
  const { push } = useToast();

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const data = await getVerificationAdmins();
      setAdmins(data.admins);
    } catch (err: any) {
      push({ message: err.message || 'Failed to load admins', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setSelectedAdmin(null);
    setModalOpen(true);
  };

  const handleEdit = (admin: VerificationAdmin) => {
    setModalMode('edit');
    setSelectedAdmin(admin);
    setModalOpen(true);
  };

  const handleDelete = async (admin: VerificationAdmin) => {
    if (!confirm(`Are you sure you want to delete admin "${admin.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteVerificationAdmin(admin.id);
      push({ message: 'Admin deleted successfully', type: 'success' });
      await loadAdmins();
    } catch (err: any) {
      push({ message: err.message || 'Failed to delete admin', type: 'error' });
    }
  };

  const handleToggleStatus = async (admin: VerificationAdmin) => {
    try {
      await updateVerificationAdmin(admin.id, { isEnabled: !admin.isEnabled });
      push({ 
        message: `Admin ${admin.isEnabled ? 'disabled' : 'enabled'} successfully`, 
        type: 'success' 
      });
      await loadAdmins();
    } catch (err: any) {
      push({ message: err.message || 'Failed to update status', type: 'error' });
    }
  };

  return (
    <AdminGuard requireType="SUPER_ADMIN">
      <div className="min-h-screen bg-neutral-950">
        <AdminNav />
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-white mb-2">Manage Verification Admins</h1>
              <p className="text-neutral-400">
                Create and manage verification admin accounts
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Admin
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : admins.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Verification Admins</h3>
              <p className="text-neutral-400 mb-6">Create your first verification admin to start reviewing tree requests.</p>
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg font-medium transition-colors"
              >
                Create First Admin
              </button>
            </div>
          ) : (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-800/40 border-b border-neutral-800/60">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Username</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Status</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Verifications</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Last Login</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Created</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-neutral-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {admins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-neutral-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">{admin.username}</div>
                          <div className="text-xs text-neutral-500">{admin.id.slice(0, 12)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            admin.isEnabled
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-neutral-500/20 text-neutral-400'
                          }`}>
                            {admin.isEnabled ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-300">{admin.verificationCount || 0}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {admin.lastLogin 
                              ? new Date(admin.lastLogin).toLocaleDateString()
                              : 'Never'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {new Date(admin.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleStatus(admin)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors bg-neutral-800/40 hover:bg-neutral-800/60 text-neutral-300 border-neutral-700/50"
                              title={admin.isEnabled ? 'Disable' : 'Enable'}
                            >
                              {admin.isEnabled ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleEdit(admin)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(admin)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                            >
                              Delete
                            </button>
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

        {/* Create/Edit Modal */}
        {modalOpen && (
          <AdminModal
            mode={modalMode}
            admin={selectedAdmin}
            onClose={() => {
              setModalOpen(false);
              setSelectedAdmin(null);
            }}
            onSuccess={() => {
              setModalOpen(false);
              setSelectedAdmin(null);
              loadAdmins();
            }}
          />
        )}
      </div>
    </AdminGuard>
  );
}

function AdminModal({
  mode,
  admin,
  onClose,
  onSuccess
}: {
  mode: 'create' | 'edit';
  admin: VerificationAdmin | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState(admin?.username || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const { push } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create' || password) {
      if (password.length < 8) {
        push({ message: 'Password must be at least 8 characters', type: 'error' });
        return;
      }
      if (password !== confirmPassword) {
        push({ message: 'Passwords do not match', type: 'error' });
        return;
      }
    }

    setProcessing(true);
    try {
      if (mode === 'create') {
        await createVerificationAdmin(username, password);
        push({ message: 'Admin created successfully', type: 'success' });
      } else if (admin) {
        const updates: any = {};
        if (username !== admin.username) updates.username = username;
        if (password) updates.password = password;
        await updateVerificationAdmin(admin.id, updates);
        push({ message: 'Admin updated successfully', type: 'success' });
      }
      onSuccess();
    } catch (err: any) {
      push({ message: err.message || 'Operation failed', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full">
        <div className="border-b border-neutral-800 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {mode === 'create' ? 'Create Verification Admin' : 'Edit Admin'}
          </h2>
          <button
            onClick={onClose}
            disabled={processing}
            className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Username *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={50}
              disabled={processing}
              className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Password {mode === 'edit' && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === 'create'}
              minLength={8}
              disabled={processing}
              className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
              placeholder="Enter password (min 8 characters)"
            />
          </div>

          {(mode === 'create' || password) && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={mode === 'create' || !!password}
                disabled={processing}
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                placeholder="Confirm password"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className="flex-1 py-3 px-4 bg-neutral-800/40 hover:bg-neutral-800/60 text-neutral-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 py-3 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {processing ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
