import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer();

// Prefer explicit env; otherwise choose docker service when running in container, else localhost for dev
const AI_BASE_URL = process.env.AI_BASE_URL || (process.env.DOCKER || process.env.CONTAINER ? 'http://miko_ai:8000' : 'http://localhost:8000');

// Quick health check for AI service
router.get('/health', async (_req, res) => {
  try {
    const resp = await fetch(`${AI_BASE_URL}/health`, { method: 'GET' });
    let data = null;
    try { data = await resp.json(); } catch {}
    return res.status(resp.ok ? 200 : 503).json({ ok: resp.ok, target: AI_BASE_URL, ai: data });
  } catch (err) {
    console.error('[verify.health] failed', err);
    return res.status(503).json({ ok: false, target: AI_BASE_URL, error: 'AI service unavailable' });
  }
});

router.post('/tree', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok:false, error:'image file is required' });
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined){
      return res.status(400).json({ ok:false, error:'latitude and longitude are required' });
    }

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' });
    form.append('image', blob, req.file.originalname || 'upload.jpg');
    form.append('latitude', String(latitude));
    form.append('longitude', String(longitude));

    const proxyUrl = `${AI_BASE_URL}/verify-tree`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(proxyUrl, { method: 'POST', body: form, signal: controller.signal }).finally(() => clearTimeout(timeout));
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err){
    console.error('[verify] proxy failed', err);
    res.status(500).json({ ok:false, error:'AI service unavailable' });
  }
});

router.post('/tree-multi', upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) return res.status(400).json({ ok:false, error:'at least 2 images required' });
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined){
      return res.status(400).json({ ok:false, error:'latitude and longitude are required' });
    }
    const form = new FormData();
    for(const f of req.files){
      const blob = new Blob([f.buffer], { type: f.mimetype || 'application/octet-stream' });
      form.append('images', blob, f.originalname || 'upload.jpg');
    }
    form.append('latitude', String(latitude));
    form.append('longitude', String(longitude));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(`${AI_BASE_URL}/verify-tree-multi`, { method: 'POST', body: form, signal: controller.signal }).finally(() => clearTimeout(timeout));
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err){
    console.error('[verify-multi] proxy failed', err);
    res.status(500).json({ ok:false, error:'AI service unavailable' });
  }
});

export default router;
