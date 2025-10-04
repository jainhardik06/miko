import { Router } from 'express';
import User from '../models/user.model.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/corporate', requireAuth, async (req,res)=>{
  const { companyName, cin, gstin } = req.body;
  if(!companyName || !cin || !gstin) return res.status(400).json({ error:'All fields required' });
  const user = await User.findById(req.user.userId);
  if(!user) return res.status(404).json({ error:'User not found' });
  user.corporateProfile = {
    companyName, cin, gstin,
    verificationStatus:'PENDING',
    submittedAt:new Date()
  };
  await user.save();
  res.json({ updated:true, corporateProfile:user.corporateProfile });
});

export default router;
