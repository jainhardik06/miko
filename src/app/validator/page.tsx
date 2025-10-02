"use client";
import { useEffect, useState, useCallback } from 'react';
import { useMikoStore } from '@/state/store';
import { MODULE_ADDRESS } from '@/config';
import { InputViewFunctionData } from '@aptos-labs/ts-sdk';

// NOTE: There is currently no view function in Move to enumerate Requests; only get_request(id) is exposed.
// For now we'll attempt a naive incremental fetch (0..N) until a gap of consecutive misses, mimicking tree fetching.
// A dedicated view (e.g., list_requests) would be more efficient and should be added later.

interface RequestRow { id: number; requester: string; submitted_at: number; status: number; rate_ppm: number; }

export default function ValidatorPortal() {
  const account = useMikoStore(s=>s.account);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  async function fetchRequest(id: number): Promise<RequestRow | null> {
    try {
      const { aptos } = await import('@/state/store');
      const [opt] = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::tree_requests::get_request`,
          functionArguments: [id],
          typeArguments: []
        } as InputViewFunctionData
      });
      if (!opt) return null;
      const o: Record<string, unknown> = opt as Record<string, unknown>;
      if (o.id === undefined) return null;
      return {
        id: Number(o.id),
        requester: String(o.requester),
        submitted_at: Number(o.submitted_at),
        status: Number(o.status),
        rate_ppm: Number(o.rate_ppm)
      };
    } catch { return null; }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const rows: RequestRow[] = [];
    // naive scan up to 100 for now
    for (let i=0; i<100; i++) {
      const r = await fetchRequest(i);
      if (!r) break; // assumes contiguous ids
      if (r.status === 1) rows.push(r); // STATUS_PENDING
    }
    setRequests(rows);
    setLoading(false);
  }, []);

  useEffect(()=>{ load(); const h = setInterval(load, 15000); return ()=>clearInterval(h); }, [account, load]);

  async function approve(id: number) {
    if (!account) return;
    setTxStatus(`Approving request #${id}…`);
    // TODO: Build & sign transaction for tree_requests::approve(id, rate_ppm)
    setTimeout(()=>{ setTxStatus(`(stub) Approved #${id}`); load(); }, 1200);
  }
  async function reject(id: number) {
    if (!account) return;
    setTxStatus(`Rejecting request #${id}…`);
    // TODO: Build & sign transaction for tree_requests::reject(id)
    setTimeout(()=>{ setTxStatus(`(stub) Rejected #${id}`); load(); }, 1200);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 space-y-12">
      <header className="space-y-4 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Validator Portal</h1>
        <p className="text-sm text-neutral-400 leading-relaxed">Review farmer submissions, assign verification status and trigger oracle rate provisioning. This interface currently uses a naive scan; add a list_requests view for production.</p>
      </header>
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400 flex items-center gap-2">Pending Submissions {loading && <span className="text-[10px] text-neutral-500">(loading)</span>}</h2>
        <div className="overflow-x-auto rounded border border-neutral-800/60">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-xs text-neutral-400">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Requester</th>
                <th className="px-3 py-2 text-left">Submitted</th>
                <th className="px-3 py-2 text-left">Rate</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t border-neutral-800/50">
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.requester}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{new Date(r.submitted_at*1000).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{r.rate_ppm || '-'} ppm</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={()=>approve(r.id)} className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px]">Approve</button>
                      <button onClick={()=>reject(r.id)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px]">Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length===0 && !loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-neutral-500">No pending submissions.</td></tr>}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[11px] text-neutral-500 border-t border-neutral-800/60 flex justify-between">
            <span>Pagination & filters placeholder</span>
            {txStatus && <span className="text-neutral-400">{txStatus}</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
