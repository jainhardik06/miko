import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer();

const AI_BASE_URL = process.env.AI_BASE_URL || 'http://miko_ai:8000';

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
    const resp = await fetch(proxyUrl, { method: 'POST', body: form });
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
    const resp = await fetch(`${AI_BASE_URL}/verify-tree-multi`, { method: 'POST', body: form });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err){
    console.error('[verify-multi] proxy failed', err);
    res.status(500).json({ ok:false, error:'AI service unavailable' });
  }
});

export default router;
