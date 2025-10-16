import { getConfig } from '@/config';

export async function submitMintSingle(token: string, file: File, lat: number, lon: number){
  const form = new FormData();
  form.append('image', file, file.name);
  form.append('latitude', String(lat));
  form.append('longitude', String(lon));
  const res = await fetch(`${getConfig().apiOrigin}/api/mint/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if(!res.ok) throw new Error(`submit failed: ${res.status}`);
  return res.json();
}

export async function submitMintMulti(token: string, files: File[], lat: number, lon: number){
  const form = new FormData();
  for(const f of files) form.append('images', f, f.name);
  form.append('latitude', String(lat));
  form.append('longitude', String(lon));
  const res = await fetch(`${getConfig().apiOrigin}/api/mint/submit-multi`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  if(!res.ok) throw new Error(`submit failed: ${res.status}`);
  return res.json();
}

export async function listPending(token: string){
  const res = await fetch(`${getConfig().apiOrigin}/api/mint/pending`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if(!res.ok) throw new Error(`fetch pending failed: ${res.status}`);
  return res.json();
}

export async function approveSubmission(token: string, id: string){
  const res = await fetch(`${getConfig().apiOrigin}/api/mint/${id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }
  });
  if(!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}

export async function rejectSubmission(token: string, id: string, reason?: string){
  const res = await fetch(`${getConfig().apiOrigin}/api/mint/${id}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ reason })
  });
  if(!res.ok) throw new Error(`reject failed: ${res.status}`);
  return res.json();
}
