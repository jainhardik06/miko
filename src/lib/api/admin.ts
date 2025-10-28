import { getConfig } from '@/config';

const API = getConfig().apiOrigin;

export interface AdminProfile {
  adminType: 'SUPER_ADMIN' | 'VERIFICATION_ADMIN';
  username: string;
  id?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface VerificationAdmin {
  id: string;
  username: string;
  isEnabled: boolean;
  createdBy: string;
  lastLogin?: string;
  createdAt: string;
  verificationCount?: number;
}

export interface TreeRequest {
  id: string;
  userId?: string;
  username?: string;
  user?: {
    id?: string;
    username?: string;
    email?: string;
    role?: string;
  };
  location: {
    type: string;
    coordinates: [number, number];
  };
  aiDecision: any;
  createdAt: string;
  estimatedCCT: number;
  status?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  cctGranted?: number;
}

export interface DashboardStats {
  stats: {
    pendingRequests: number;
    approvedTrees: number;
    rejectedRequests: number;
    totalUsers: number;
  };
  recentActivity: Array<{
    id: string;
    status: string;
    userId: string;
    timestamp: string;
    reviewedBy?: string;
  }>;
}

// ==================== AUTHENTICATION ====================

export async function loginSuperAdmin(username: string, password: string) {
  console.log('[API] Attempting super admin login for:', username);
  
  const res = await fetch(`${API}/api/admin/auth/super-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  console.log('[API] Super admin login response status:', res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[API] Super admin login error response:', errorText);
    
    try {
      const error = JSON.parse(errorText);
      throw new Error(error.error || 'Login failed');
    } catch (parseError) {
      throw new Error('Login failed: ' + res.status);
    }
  }

  const data = await res.json();
  console.log('[API] Super admin login successful:', data);
  return data;
}

export async function loginVerificationAdmin(username: string, password: string) {
  const res = await fetch(`${API}/api/admin/auth/verification-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Login failed');
  }

  return res.json();
}

export async function logoutAdmin() {
  const res = await fetch(`${API}/api/admin/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Logout failed');
  return res.json();
}

export async function getAdminProfile(): Promise<AdminProfile> {
  const res = await fetch(`${API}/api/admin/auth/me`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

// ==================== SUPER ADMIN: VERIFICATION ADMIN MANAGEMENT ====================

export async function createVerificationAdmin(username: string, password: string) {
  const res = await fetch(`${API}/api/admin/verification-admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create admin');
  }

  return res.json();
}

export async function getVerificationAdmins(): Promise<{ admins: VerificationAdmin[] }> {
  const res = await fetch(`${API}/api/admin/verification-admins`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch admins');
  return res.json();
}

export async function getVerificationAdmin(id: string) {
  const res = await fetch(`${API}/api/admin/verification-admins/${id}`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch admin');
  return res.json();
}

export async function updateVerificationAdmin(
  id: string, 
  updates: { username?: string; password?: string; isEnabled?: boolean }
) {
  const res = await fetch(`${API}/api/admin/verification-admins/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update admin');
  }

  return res.json();
}

export async function deleteVerificationAdmin(id: string) {
  const res = await fetch(`${API}/api/admin/verification-admins/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to delete admin');
  return res.json();
}

// ==================== DASHBOARD & STATS ====================

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API}/api/admin/dashboard/stats`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// ==================== VERIFICATION WORKFLOW ====================

export async function getVerificationQueue(page = 1, limit = 20) {
  const res = await fetch(`${API}/api/admin/verification/queue?page=${page}&limit=${limit}`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function getRequestDetails(id: string): Promise<TreeRequest> {
  const res = await fetch(`${API}/api/admin/verification/requests/${id}`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch request');
  return res.json();
}

export async function approveRequest(id: string, cctGrant: number, notes?: string) {
  const res = await fetch(`${API}/api/admin/verification/requests/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ cctGrant, notes })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to approve');
  }

  return res.json();
}

export async function rejectRequest(id: string, reason: string) {
  const res = await fetch(`${API}/api/admin/verification/requests/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to reject');
  }

  return res.json();
}

export async function getVerificationHistory() {
  const res = await fetch(`${API}/api/admin/verification/history`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function getAllRequests(status?: string, page = 1, limit = 50) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append('status', status);

  const res = await fetch(`${API}/api/admin/verification/all-requests?${params}`, {
    credentials: 'include'
  });

  if (!res.ok) throw new Error('Failed to fetch requests');
  return res.json();
}
