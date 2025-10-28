import { Router } from 'express';
import multer from 'multer';
import TreeSubmission from '../models/treeSubmission.model.js';
import Tree from '../models/tree.model.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const upload = multer();
const AI_BASE_URL = process.env.AI_BASE_URL || (process.env.DOCKER || process.env.CONTAINER ? 'http://miko_ai:8000' : 'http://localhost:8000');

// Submit mint for verification
router.post('/submit', requireAuth, upload.single('image'), async (req,res)=>{
  try {
    const { latitude, longitude } = req.body;
    if (!req.file) return res.status(400).json({ error:'image required' });
    if (latitude===undefined || longitude===undefined) return res.status(400).json({ error:'lat/lon required' });

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' });
    form.append('image', blob, req.file.originalname || 'upload.jpg');
    form.append('latitude', String(latitude));
    form.append('longitude', String(longitude));

    const resp = await fetch(`${AI_BASE_URL}/verify-tree`, { method: 'POST', body: form });
    const ai = await resp.json();
    if (resp.status >= 400){
      return res.status(resp.status).json(ai);
    }

    const sub = await TreeSubmission.create({
      userId: req.user.userId,
      status: ai.status === 'PASSED' || ai.status === 'FLAGGED' ? 'PENDING' : 'REJECTED',
      location: { type:'Point', coordinates: [Number(longitude), Number(latitude)] },
      phash: ai.artifacts?.phash,
      vector: ai.artifacts?.vector,
      aiDecision: ai
    });
    res.json({ ok:true, submissionId: sub._id, status: sub.status, ai });
  } catch (e){
    console.error('[mint.submit] error', e);
    res.status(500).json({ error:'submit failed' });
  }
});

// Submit multi-view mint
router.post('/submit-multi', requireAuth, upload.array('images', 6), async (req,res)=>{
  try {
    const { latitude, longitude } = req.body;
    if (!req.files || req.files.length < 2) return res.status(400).json({ error:'at least 2 images required' });
    if (latitude===undefined || longitude===undefined) return res.status(400).json({ error:'lat/lon required' });

    const form = new FormData();
    for(const f of req.files){
      const blob = new Blob([f.buffer], { type: f.mimetype || 'application/octet-stream' });
      form.append('images', blob, f.originalname || 'upload.jpg');
    }
    form.append('latitude', String(latitude));
    form.append('longitude', String(longitude));

    const resp = await fetch(`${AI_BASE_URL}/verify-tree-multi`, { method: 'POST', body: form });
    const ai = await resp.json();
    if (resp.status >= 400){
      return res.status(resp.status).json(ai);
    }

    const sub = await TreeSubmission.create({
      userId: req.user.userId,
      status: ai.status === 'PASSED' || ai.status === 'FLAGGED' ? 'PENDING' : 'REJECTED',
      location: { type:'Point', coordinates: [Number(longitude), Number(latitude)] },
      phash: Array.isArray(ai.artifacts?.phashes) ? ai.artifacts.phashes[0] : undefined,
      vector: ai.artifacts?.vector,
      aiDecision: ai
    });
    res.json({ ok:true, submissionId: sub._id, status: sub.status, ai });
  } catch (e){
    console.error('[mint.submit-multi] error', e);
    res.status(500).json({ error:'submit failed' });
  }
});

// List pending submissions for review
router.get('/pending', requireAuth, requireRole('ADMIN','VALIDATOR'), async (_req,res)=>{
  const docs = await TreeSubmission.find({ status:'PENDING' }).sort({ createdAt:-1 }).limit(100);
  res.json(docs);
});

// Approve a submission
router.post('/:id/approve', requireAuth, requireRole('ADMIN','VALIDATOR'), async (req,res)=>{
  const { id } = req.params;
  const doc = await TreeSubmission.findByIdAndUpdate(id, { status:'APPROVED', reviewedBy:req.user.userId, reviewedAt:new Date() }, { new:true });
  if(!doc) return res.status(404).json({ error:'not found' });
  // Persist into trees collection for future dedupe
  await Tree.create({
    submissionId: doc._id,
    userId: doc.userId,
    location: doc.location,
    phash: doc.phash,
    vector: doc.vector
  });
  // TODO: trigger on-chain mint workflow here
  res.json({ ok:true, submission: doc });
});

// Reject a submission
router.post('/:id/reject', requireAuth, requireRole('ADMIN','VALIDATOR'), async (req,res)=>{
  const { id } = req.params;
  const { reason } = req.body || {};
  const doc = await TreeSubmission.findByIdAndUpdate(id, { status:'REJECTED', reviewNotes: reason || '', reviewedBy:req.user.userId, reviewedAt:new Date() }, { new:true });
  if(!doc) return res.status(404).json({ error:'not found' });
  res.json({ ok:true, submission: doc });
});

export default router;
