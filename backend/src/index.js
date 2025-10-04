import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import './config/passport.js';
import { connectDb } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';

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
app.use(express.json());
app.use(passport.initialize());

app.get('/api/health', (_req,res)=> res.json({ ok:true, service:'auth', time:Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

const PORT = process.env.PORT || 5001;
connectDb().then(()=> {
  app.listen(PORT, ()=> console.log(`Auth API running on :${PORT}`));
}).catch(err=>{
  console.error('Failed to start server', err);
  process.exit(1);
});
