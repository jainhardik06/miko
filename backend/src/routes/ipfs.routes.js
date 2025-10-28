import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { makePinataClient, toGatewayUrl } from '../config/pinata.js';

const router = Router();
const upload = multer();

// POST /api/ipfs/upload - multipart/form-data { file }
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const client = makePinataClient();

    const fd = new FormData();
    fd.append('file', req.file.buffer, { filename: req.file.originalname || 'upload', contentType: req.file.mimetype || 'application/octet-stream' });
    // Optional: pass metadata
    const name = (req.body && req.body.name) ? String(req.body.name) : req.file.originalname || 'upload';
    const pinataMetadata = JSON.stringify({ name });
    fd.append('pinataMetadata', pinataMetadata, { contentType: 'application/json' });

    const headers = { ...fd.getHeaders(), ...client.defaults.headers.common };
    const resp = await client.post('/pinning/pinFileToIPFS', fd, { headers });
    const cid = resp?.data?.IpfsHash || resp?.data?.cid || resp?.data?.hash;
    if (!cid) return res.status(502).json({ error: 'pin_failed', details: resp?.data });
    return res.json({ cid, ipfsUri: `ipfs://${cid}`, gatewayUrl: toGatewayUrl(cid) });
  } catch (e) {
    console.error('[ipfs.upload] error', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

// POST /api/ipfs/upload-json - body JSON { data: any, name?: string }
router.post('/upload-json', async (req, res) => {
  try {
    const data = req.body?.data;
    if (data == null) return res.status(400).json({ error: 'data is required' });
    const client = makePinataClient();
    const payload = {
      pinataContent: data,
      pinataMetadata: { name: req.body?.name || 'metadata.json' }
    };
    const resp = await client.post('/pinning/pinJSONToIPFS', payload, { headers: { 'Content-Type': 'application/json' } });
    const cid = resp?.data?.IpfsHash || resp?.data?.cid || resp?.data?.hash;
    if (!cid) return res.status(502).json({ error: 'pin_failed', details: resp?.data });
    return res.json({ cid, ipfsUri: `ipfs://${cid}`, gatewayUrl: toGatewayUrl(cid) });
  } catch (e) {
    console.error('[ipfs.upload-json] error', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

// POST /api/ipfs/upload-bundle - body { imageDataUrl?: string, metadata?: object }
// Converts data URL to file and uploads both image and metadata JSON to IPFS
router.post('/upload-bundle', async (req, res) => {
  try {
    const { imageDataUrl, metadata } = req.body || {};
    const client = makePinataClient();
    let imageCid = null;
    if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:')) {
      const match = imageDataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) return res.status(400).json({ error: 'Invalid image data URL' });
      const mime = match[1];
      const b64 = match[2];
      const buf = Buffer.from(b64, 'base64');
      const fd = new FormData();
      const filename = `image-${Date.now()}`;
      fd.append('file', buf, { filename, contentType: mime || 'application/octet-stream' });
      fd.append('pinataMetadata', JSON.stringify({ name: filename }), { contentType: 'application/json' });
      const headers = { ...fd.getHeaders(), ...client.defaults.headers.common };
      const resp = await client.post('/pinning/pinFileToIPFS', fd, { headers });
      imageCid = resp?.data?.IpfsHash || resp?.data?.cid || resp?.data?.hash;
    }

    const metaObj = { ...(metadata || {}) };
    if (imageCid) metaObj.image = `ipfs://${imageCid}`;
    const metaResp = await client.post('/pinning/pinJSONToIPFS', { pinataContent: metaObj, pinataMetadata: { name: `meta-${Date.now()}.json` } }, { headers: { 'Content-Type': 'application/json' } });
    const metaCid = metaResp?.data?.IpfsHash || metaResp?.data?.cid || metaResp?.data?.hash;

    return res.json({
      image: imageCid ? { cid: imageCid, ipfsUri: `ipfs://${imageCid}`, gatewayUrl: toGatewayUrl(imageCid) } : null,
      metadata: metaCid ? { cid: metaCid, ipfsUri: `ipfs://${metaCid}`, gatewayUrl: toGatewayUrl(metaCid) } : null
    });
  } catch (e) {
    console.error('[ipfs.upload-bundle] error', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

export default router;
