import { Router } from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const router = Router();

function ensureDirSync(dir){
  if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function randomName(prefix, ext){
  const rand = crypto.randomBytes(8).toString('hex');
  const ts = Date.now();
  return `${prefix}-${ts}-${rand}${ext}`;
}

function getBaseUrl(req){
  const envBase = process.env.PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, '');
  const host = req.get('host');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
  return `${proto}://${host}`;
}

// POST /api/storage/upload
// Body: { imageDataUrl?: string, metadata?: object }
// Returns: { imageUrl?: string, metadataUrl: string }
router.post('/upload', async (req, res) => {
  try {
    // Align upload location with static folder served by index.js
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const baseDir = path.join(__dirname, '..', '..', '..', 'uploads');
    const imagesDir = path.join(baseDir, 'images');
    const metaDir = path.join(baseDir, 'meta');
    ensureDirSync(imagesDir);
    ensureDirSync(metaDir);

    let imageUrl;
    const { imageDataUrl, metadata } = req.body || {};

    if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:')) {
      // Parse data URL: data:<mime>;base64,<data>
      const match = imageDataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) return res.status(400).json({ error: 'Invalid image data URL' });
      const mime = match[1];
      const b64 = match[2];
      const buf = Buffer.from(b64, 'base64');
      // Determine extension
      let ext = '.bin';
      if (mime === 'image/png') ext = '.png';
      else if (mime === 'image/jpeg') ext = '.jpg';
      else if (mime === 'image/webp') ext = '.webp';
      const fname = randomName('img', ext);
      const fpath = path.join(imagesDir, fname);
      await fsp.writeFile(fpath, buf);
      imageUrl = `${getBaseUrl(req)}/uploads/images/${fname}`;
    }

    // Build metadata, link to image if present
    const metaObj = { ...(metadata || {}) };
    if (imageUrl) metaObj.image = imageUrl;
    // Save metadata json
    const metaName = randomName('meta', '.json');
    const metaPath = path.join(metaDir, metaName);
    await fsp.writeFile(metaPath, JSON.stringify(metaObj, null, 2), 'utf8');
    const metadataUrl = `${getBaseUrl(req)}/uploads/meta/${metaName}`;

    return res.json({ imageUrl, metadataUrl });
  } catch (e) {
    console.error('Upload error', e);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

export default router;
