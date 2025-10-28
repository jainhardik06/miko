import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import './config/passport.js';
import { connectDb } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import verifyRoutes from './routes/verify.routes.js';
import mintRoutes from './routes/mint.routes.js';
import speciesRoutes from './routes/species.routes.js';
import storageRoutes from './routes/storage.routes.js';
import ipfsRoutes from './routes/ipfs.routes.js';
import adminRoutes from './routes/admin.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import blockchainRoutes from './routes/blockchain.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Enhanced CORS: allow comma‑separated CLIENT_ORIGIN list plus common localhost variants.
const clientOriginEnv = process.env.CLIENT_ORIGIN || '';
const explicitOrigins = clientOriginEnv.split(',').map(o=>o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb)=>{
    if(!origin) return cb(null,true); // same-origin or curl
    if(explicitOrigins.includes(origin)) return cb(null,true);
    if(/https?:\/\/localhost:3000$/.test(origin)) return cb(null,true);
    if(/https?:\/\/127\.0\.0\.1:3000$/.test(origin)) return cb(null,true);
    console.warn('[CORS] Blocked origin', origin, 'Allowed list:', explicitOrigins);
    return cb(new Error('CORS not allowed'));
  },
  credentials: true
}));
// Allow larger JSON bodies for image data URLs (kept modest to avoid abuse)
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(passport.initialize());

app.get('/api/health', (_req,res)=> res.json({ ok:true, service:'auth', time:Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/mint', mintRoutes);
app.use('/api/species', speciesRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/ipfs', ipfsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/blockchain', blockchainRoutes);

// Static hosting for uploaded assets under /uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

const PORT = process.env.PORT || 5001;
// Start server regardless, attempt DB connect in background so storage/upload works without Mongo
app.listen(PORT, ()=> console.log(`API running on :${PORT}`));
connectDb().catch(err=>{
  console.warn('[db] Startup warning:', err?.message || err);
  console.warn('[db] Continuing without MongoDB (routes that require DB may fail)');
});
