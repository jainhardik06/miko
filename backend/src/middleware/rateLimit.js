// Simple in-memory rate limiter (NOT for production scale)
// Keyed per IP + route id within a sliding window
// Env overrides: RATE_LIMIT_WINDOW_MS (default 60000), RATE_LIMIT_MAX (default 30)

const buckets = new Map(); // key -> { count, expires }

export function rateLimit({ windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS||'60000',10), max = parseInt(process.env.RATE_LIMIT_MAX||'30',10), keyFn } = {}){
  return function rl(req,res,next){
    const now = Date.now();
    const keyBase = keyFn ? keyFn(req) : req.ip + ':' + req.path;
    const key = keyBase;
    let bucket = buckets.get(key);
    if(!bucket || bucket.expires <= now){
      bucket = { count:0, expires: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if(bucket.count > max){
      const retryAfter = Math.ceil((bucket.expires - now)/1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error:'Too many requests', retryAfter });
    }
    next();
  };
}

// Lightweight cleanup every 5 minutes
setInterval(()=>{
  const now = Date.now();
  for(const [k,v] of buckets.entries()) if(v.expires <= now) buckets.delete(k);
}, 300000).unref();
