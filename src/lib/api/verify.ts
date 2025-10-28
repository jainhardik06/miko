import { getConfig } from '@/config';

export type VerifyResult = {
  status: 'PASSED' | 'REJECTED' | 'FLAGGED';
  reason?: string;
  metrics?: Record<string, any>;
  degraded?: boolean;
  artifacts?: { phash?: string; vector?: number[]; phashes?: string[] };
};

export class VerifyApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any){
    super(message);
    this.name = 'VerifyApiError';
    this.status = status;
    this.data = data;
  }
}

export async function verifyTree(file: File, lat: number, lon: number): Promise<VerifyResult> {
  const form = new FormData();
  form.append('image', file, file.name || 'capture.jpg');
  form.append('latitude', String(lat));
  form.append('longitude', String(lon));

  const res = await fetch(`${getConfig().apiOrigin}/api/verify/tree`, {
    method: 'POST',
    body: form
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const message = (data && (data.error || data.reason)) || `verify failed: ${res.status}`;
    throw new VerifyApiError(message, res.status, data);
  }
  return data as VerifyResult;
}
