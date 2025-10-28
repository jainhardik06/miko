import { getConfig } from '@/config';

export type UploadResult = { cid: string; ipfsUri: string; gatewayUrl: string };

export async function uploadFileToIPFS(file: File, name?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file, file.name || 'upload');
  if (name) form.append('name', name);
  const res = await fetch(`${getConfig().apiOrigin}/api/ipfs/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`pin file failed: ${res.status}`);
  return res.json();
}

export async function uploadJSONToIPFS(data: any, name?: string): Promise<UploadResult> {
  const res = await fetch(`${getConfig().apiOrigin}/api/ipfs/upload-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, name }),
  });
  if (!res.ok) throw new Error(`pin json failed: ${res.status}`);
  return res.json();
}

export async function uploadImageDataUrlBundle(imageDataUrl: string | null, metadata: any): Promise<{ image: UploadResult | null; metadata: UploadResult | null }>{
  const res = await fetch(`${getConfig().apiOrigin}/api/ipfs/upload-bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, metadata }),
  });
  if (!res.ok) throw new Error(`pin bundle failed: ${res.status}`);
  return res.json();
}
