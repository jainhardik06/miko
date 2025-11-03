"use client";
import { useEffect, useState } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminNav } from '@/components/admin/AdminNav';
import { 
  getVerificationQueue, 
  getRequestDetails, 
  approveRequest, 
  rejectRequest,
  type TreeRequest 
} from '@/lib/api/admin';
import { useToast } from '@/components/ToastProvider';

export default function VerificationQueuePage() {
  const [requests, setRequests] = useState<TreeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<TreeRequest | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      const data = await getVerificationQueue(1, 50);
      const enriched = await Promise.all(
  data.requests.map(async (request: TreeRequest) => {
          const needsHydration =
            !request.treeName ||
            !request.speciesCommon ||
            !request.aiDecision?.status ||
            !request.location ||
            request.location.coordinates.every((coord) => coord === 0) ||
            !request.estimatedCCT ||
            request.estimatedCCT === 0;

          if (!needsHydration) {
            return request;
          }

          try {
            const details = await getRequestDetails(request.id);
            return {
              ...request,
              location: details.location || request.location,
              aiDecision: details.aiDecision || request.aiDecision,
              estimatedCCT: details.estimatedCCT || request.estimatedCCT,
              treeName: details.treeName || request.treeName,
              speciesCommon: details.speciesCommon || request.speciesCommon,
              metadata: details.metadata || request.metadata,
              metadataUri: details.metadataUri || request.metadataUri,
              imageUrl: details.imageUrl ?? request.imageUrl,
              user: details.user || request.user,
            } satisfies TreeRequest;
          } catch (err) {
            console.warn('[admin] Failed to hydrate queue item', request.id, err);
            return request;
          }
        })
      );
      setRequests(enriched);
    } catch (err: any) {
      push({ message: err.message || 'Failed to load queue', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string) => {
    try {
      const details = await getRequestDetails(id);
      setSelectedRequest(details);
      setReviewModalOpen(true);
    } catch (err: any) {
      push({ message: err.message || 'Failed to load request', type: 'error' });
    }
  };

  const handleApprove = async (cctGrant: number, notes?: string) => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    try {
      await approveRequest(selectedRequest.id, cctGrant, notes);
      push({ message: 'Request approved successfully', type: 'success' });
      setReviewModalOpen(false);
      setSelectedRequest(null);
      await loadQueue();
    } catch (err: any) {
      push({ message: err.message || 'Failed to approve', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedRequest) return;
    
    setProcessing(true);
    try {
      await rejectRequest(selectedRequest.id, reason);
      push({ message: 'Request rejected', type: 'success' });
      setReviewModalOpen(false);
      setSelectedRequest(null);
      await loadQueue();
    } catch (err: any) {
      push({ message: err.message || 'Failed to reject', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminGuard requireType="ANY">
      <div className="min-h-screen bg-neutral-950">
        <AdminNav />
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white mb-2">Verification Queue</h1>
            <p className="text-neutral-400">
              Review and verify pending tree registration requests
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
              <p className="text-neutral-400">No pending requests to review at the moment.</p>
            </div>
          ) : (
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-800/40 border-b border-neutral-800/60">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">User</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Location</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">AI Score</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Est. CCT</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-neutral-300">Submitted</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-neutral-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {requests.map((request: TreeRequest) => (
                      <tr key={request.id} className="hover:bg-neutral-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm text-white">{request.treeName || request.username || 'Unknown'}</div>
                          <div className="text-xs text-neutral-500">
                            {request.speciesCommon ? `${request.speciesCommon} · ` : ''}
                            {request.userId ? `${request.userId.slice(0, 8)}...` : (request.username || 'N/A')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-300">
                            {request.location?.coordinates?.every((coord: number) => coord === 0)
                              ? 'Pending'
                              : `${request.location.coordinates[1].toFixed(4)}, ${request.location.coordinates[0].toFixed(4)}`}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            request.aiDecision?.status === 'PASSED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : request.aiDecision?.status === 'FLAGGED'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-neutral-500/20 text-neutral-400'
                          }`}>
                            {request.aiDecision?.metrics?.tree_score 
                              ? (request.aiDecision.metrics.tree_score * 100).toFixed(0) + '%'
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-emerald-400">
                            {request.estimatedCCT} CCT
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-neutral-400">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleReview(request.id)}
                            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* Review Modal */}
        {reviewModalOpen && selectedRequest && (
          <ReviewModal
            request={selectedRequest}
            onClose={() => {
              setReviewModalOpen(false);
              setSelectedRequest(null);
            }}
            onApprove={handleApprove}
            onReject={handleReject}
            processing={processing}
          />
        )}
      </div>
    </AdminGuard>
  );
}

function ReviewModal({
  request,
  onClose,
  onApprove,
  onReject,
  processing
}: {
  request: TreeRequest;
  onClose: () => void;
  onApprove: (cct: number, notes?: string) => void;
  onReject: (reason: string) => void;
  processing: boolean;
}) {
  const [cctGrant, setCctGrant] = useState(request.estimatedCCT.toString());
  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [mode, setMode] = useState<'review' | 'approve' | 'reject'>('review');

  const formDetails: Record<string, any> = request.metadata?.form || {};
  const attrDetails: Record<string, any> = request.metadata?.attributes || {};
  const displayName: string | undefined = request.treeName || formDetails.name || attrDetails.name;
  const displaySpecies: string | undefined = request.speciesCommon || formDetails.speciesCommon || attrDetails.speciesCommon;
  const displayScientific: string | undefined = formDetails.speciesScientific || attrDetails.speciesScientific;
  const displayAge = formDetails.age ?? attrDetails.age;
  const displayHeight = formDetails.heightM ?? attrDetails.heightM;
  const displayGirth = formDetails.girthCm ?? attrDetails.girthCm;
  const displayNotes: string | undefined = formDetails.details || attrDetails.details;
  const diseaseList: Array<Record<string, any>> = Array.isArray(attrDetails.diseases)
    ? attrDetails.diseases
    : Array.isArray(formDetails.diseases)
      ? formDetails.diseases
      : [];

  const handleApproveSubmit = () => {
    const amount = parseInt(cctGrant);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid CCT amount');
      return;
    }
    onApprove(amount, notes || undefined);
  };

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onReject(rejectReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-6 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">Review Request</h2>
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

        <div className="p-6 space-y-6">
          {mode === 'review' && (
            <>
              {/* User Info */}
              <div className="bg-neutral-800/40 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-300 mb-3">Submitter Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-500">Username:</span>
                    <div className="text-white mt-1">{request.user?.username || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Email:</span>
                    <div className="text-white mt-1">{request.user?.email || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">User ID:</span>
                    <div className="text-white mt-1 font-mono text-xs">{request.user?.id || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-neutral-500">Role:</span>
                    <div className="text-white mt-1">{request.user?.role || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="bg-neutral-800/40 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-300 mb-3">Location</h3>
                <div className="text-sm text-white">
                  Lat: {request.location.coordinates[1].toFixed(6)}, Lon: {request.location.coordinates[0].toFixed(6)}
                </div>
              </div>

              {(displayName || displaySpecies || displayScientific || displayAge != null || displayHeight != null || displayGirth != null || displayNotes || diseaseList.length > 0) && (
                <div className="bg-neutral-800/40 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-neutral-300 mb-3">Tree Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {displayName && (
                      <div>
                        <span className="text-neutral-500">Tree Name:</span>
                        <div className="text-white mt-1">{displayName}</div>
                      </div>
                    )}
                    {displaySpecies && (
                      <div>
                        <span className="text-neutral-500">Species:</span>
                        <div className="text-white mt-1">{displaySpecies}</div>
                      </div>
                    )}
                    {displayScientific && (
                      <div>
                        <span className="text-neutral-500">Scientific:</span>
                        <div className="text-white mt-1">{displayScientific}</div>
                      </div>
                    )}
                    {displayAge != null && (
                      <div>
                        <span className="text-neutral-500">Approx. Age:</span>
                        <div className="text-white mt-1">{displayAge}</div>
                      </div>
                    )}
                    {displayHeight != null && (
                      <div>
                        <span className="text-neutral-500">Height (m):</span>
                        <div className="text-white mt-1">{displayHeight}</div>
                      </div>
                    )}
                    {displayGirth != null && (
                      <div>
                        <span className="text-neutral-500">Girth (cm):</span>
                        <div className="text-white mt-1">{displayGirth}</div>
                      </div>
                    )}
                    {displayNotes && (
                      <div className="col-span-2">
                        <span className="text-neutral-500">Notes:</span>
                        <p className="text-sm text-white mt-1 whitespace-pre-wrap">{displayNotes}</p>
                      </div>
                    )}
                    {diseaseList.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-neutral-500 block mb-2">Reported Diseases:</span>
                        <div className="space-y-2">
                          {diseaseList.map((disease, idx) => (
                            <div key={idx} className="border border-neutral-700/40 rounded-lg p-3">
                              <div className="text-white font-medium">{disease.name || `Entry ${idx + 1}`}</div>
                              {disease.appearance && (
                                <div className="text-xs text-neutral-400 mt-1">{disease.appearance}</div>
                              )}
                              {typeof disease.photo === 'string' && disease.photo && (
                                <a
                                  href={disease.photo}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-emerald-400 hover:underline mt-2 inline-block"
                                >
                                  View photo
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Decision */}
              <div className="bg-neutral-800/40 rounded-lg p-4">
                <h3 className="text-sm font-medium text-neutral-300 mb-3">AI Verification Results</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      request.aiDecision?.status === 'PASSED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : request.aiDecision?.status === 'FLAGGED'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {request.aiDecision?.status || 'UNKNOWN'}
                    </span>
                  </div>
                  {request.aiDecision?.metrics?.tree_score !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Tree Confidence:</span>
                      <span className="text-sm text-white font-medium">
                        {(request.aiDecision.metrics.tree_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {request.aiDecision?.reason && (
                    <div className="pt-2 border-t border-neutral-700/50">
                      <span className="text-sm text-neutral-400">Reason:</span>
                      <p className="text-sm text-white mt-1">{request.aiDecision.reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* CCT Estimate */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-emerald-400 mb-2">Estimated CCT Grant</h3>
                <div className="text-2xl font-bold text-emerald-400">{request.estimatedCCT} CCT</div>
                <p className="text-xs text-emerald-400/70 mt-2">
                  This is an AI-calculated estimate. You can modify this value during approval.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setMode('approve')}
                  disabled={processing}
                  className="flex-1 py-3 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Approve Request
                </button>
                <button
                  onClick={() => setMode('reject')}
                  disabled={processing}
                  className="flex-1 py-3 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Reject Request
                </button>
              </div>
            </>
          )}

          {mode === 'approve' && (
            <div className="space-y-4">
              <button
                onClick={() => setMode('review')}
                className="text-sm text-neutral-400 hover:text-white flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Review
              </button>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  CCT Grant Amount *
                </label>
                <input
                  type="number"
                  value={cctGrant}
                  onChange={(e) => setCctGrant(e.target.value)}
                  min="1"
                  className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Enter CCT amount"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  AI estimated: {request.estimatedCCT} CCT. You can modify this based on your review.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Add any verification notes..."
                />
              </div>

              <button
                onClick={handleApproveSubmit}
                disabled={processing}
                className="w-full py-3 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm Approval'}
              </button>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-4">
              <button
                onClick={() => setMode('review')}
                className="text-sm text-neutral-400 hover:text-white flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Review
              </button>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  placeholder="Explain why this request is being rejected..."
                />
              </div>

              <button
                onClick={handleRejectSubmit}
                disabled={processing}
                className="w-full py-3 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
