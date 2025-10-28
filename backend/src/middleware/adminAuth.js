import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import VerificationAdmin from '../models/verificationAdmin.model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const SUPER_ADMIN_PASSWORD_HASH = process.env.SUPER_ADMIN_PASSWORD_HASH;

// Generate admin JWT token
export function signAdminToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: process.env.ADMIN_JWT_EXPIRES || '8h' 
  });
}

// Verify admin JWT token
export function verifyAdminToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Extract token from HTTP-only cookie or Authorization header
export function extractAdminToken(req) {
  // Try cookie first
  if (req.cookies?.admin_token) {
    return req.cookies.admin_token;
  }
  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Middleware: Require any admin authentication
export function requireAdminAuth(req, res, next) {
  const token = extractAdminToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const decoded = verifyAdminToken(token);
  if (!decoded || !decoded.adminType) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  req.admin = decoded;
  next();
}

// Middleware: Require Super Admin only
export function requireSuperAdmin(req, res, next) {
  const token = extractAdminToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Super admin authentication required' });
  }

  const decoded = verifyAdminToken(token);
  if (!decoded || decoded.adminType !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  req.admin = decoded;
  next();
}

// Middleware: Require Verification Admin (or Super Admin)
export function requireVerificationAdmin(req, res, next) {
  const token = extractAdminToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Verification admin authentication required' });
  }

  const decoded = verifyAdminToken(token);
  if (!decoded || !['SUPER_ADMIN', 'VERIFICATION_ADMIN'].includes(decoded.adminType)) {
    return res.status(403).json({ error: 'Verification admin access required' });
  }

  req.admin = decoded;
  next();
}

// Verify Super Admin credentials against env vars
export async function verifySuperAdminCredentials(username, password) {
  if (!SUPER_ADMIN_PASSWORD_HASH) {
    throw new Error('Super admin not configured. Set SUPER_ADMIN_PASSWORD_HASH in environment.');
  }

  if (username !== SUPER_ADMIN_USERNAME) {
    return false;
  }

  return await bcryptjs.compare(password, SUPER_ADMIN_PASSWORD_HASH);
}

// Verify Verification Admin credentials against database
export async function verifyVerificationAdminCredentials(username, password) {
  const admin = await VerificationAdmin.findOne({ username, isEnabled: true });
  
  if (!admin) {
    return null;
  }

  const isValid = await bcryptjs.compare(password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  // Update last login
  admin.lastLogin = new Date();
  await admin.save();

  return {
    id: admin._id.toString(),
    username: admin.username,
    createdAt: admin.createdAt
  };
}

// Hash password helper
export async function hashPassword(password) {
  return await bcryptjs.hash(password, 12);
}
