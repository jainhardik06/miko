import jwt from 'jsonwebtoken';

export function requireAuth(req,res,next){
  // Support Authorization header and optional token query param for redirect flows
  let token;
  const header = req.headers.authorization;
  if(header){ token = header.replace(/^Bearer\s+/i,''); }
  if(!token && typeof req.query?.token === 'string'){
    token = req.query.token;
  }
  if(!token) return res.status(401).json({ error:'Missing Authorization token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch(e){
    return res.status(401).json({ error:'Invalid or expired token' });
  }
}

export function signSession(user){
  const payload = { userId: user._id.toString(), role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });
  return token;
}
