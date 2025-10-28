import { uploadImageDataUrlBundle, uploadFileToIPFS } from './ipfs';

export type DiseaseEntry = { id: string; name: string; appearance: string; photoDataUrl?: string };

export async function uploadCapturedImageAndMetadata(capturedDataUrl: string | null, metadata: any){
  // Uses the backend bundle endpoint so metadata.image points to ipfs://<cid>
  return uploadImageDataUrlBundle(capturedDataUrl, metadata);
}

export async function uploadDiseaseImages(entries: DiseaseEntry[]){
  const results: Record<string, { cid: string; ipfsUri: string; gatewayUrl: string } | null> = {};
  for(const e of entries){
    if (e.photoDataUrl && e.photoDataUrl.startsWith('data:')){
      const blob = dataURLtoBlob(e.photoDataUrl);
      const file = new File([blob], `${e.id || e.name || 'disease'}-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
      const pinned = await uploadFileToIPFS(file, file.name);
      results[e.id || e.name] = pinned;
    } else {
      results[e.id || e.name] = null;
    }
  }
  return results;
}

function dataURLtoBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error('invalid data url');
  const mime = match[1];
  const b64 = match[2];
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i=0; i<len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
