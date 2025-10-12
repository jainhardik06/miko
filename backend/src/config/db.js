import mongoose from 'mongoose';

/**
 * Connect to MongoDB with retry + backoff.
 * Env overrides:
 *  DB_CONNECT_MAX_RETRIES (default 10)
 *  DB_CONNECT_BACKOFF_MS  (initial, default 1000)
 *  DB_CONNECT_BACKOFF_FACTOR (default 1.5)
 */
export async function connectDb(){
  const uri = process.env.DATABASE_URL?.trim();
  if(!uri) throw new Error('DATABASE_URL missing');
  validateMongoUri(uri);
  const maxRetries = parseInt(process.env.DB_CONNECT_MAX_RETRIES || '10', 10);
  const backoffStart = parseInt(process.env.DB_CONNECT_BACKOFF_MS || '1000', 10);
  const factor = parseFloat(process.env.DB_CONNECT_BACKOFF_FACTOR || '1.5');
  const options = { autoIndex: true };
  if(process.env.DATABASE_NAME){
    options.dbName = process.env.DATABASE_NAME;
  }
  mongoose.set('strictQuery', true);

  let attempt = 0; let delay = backoffStart; let lastErr;
  while(attempt <= maxRetries){
    try {
      attempt += 1;
      console.log(`[db] Attempt ${attempt}/${maxRetries} connecting to Mongo...`);
      await mongoose.connect(uri, options);
      console.log('[db] Mongo connected');
      return;
    } catch(err){
      lastErr = err;
      console.error(`[db] Connection attempt ${attempt} failed:`, err.message);
      if(attempt >= maxRetries){
        break;
      }
      console.log(`[db] Retrying in ${delay}ms`);
      await new Promise(r=>setTimeout(r, delay));
      delay = Math.ceil(delay * factor);
    }
  }
  throw new Error(`Failed to connect to Mongo after ${maxRetries} attempts: ${lastErr?.message}`);
}

function validateMongoUri(uri){
  const trimmed = uri.trim();
  const pattern = /^mongodb(?:\+srv)?:\/\/([^@]*@)?([^/?]+)/i;
  const match = trimmed.match(pattern);
  if(!match){
    throw new Error('DATABASE_URL is not a valid MongoDB connection string');
  }
  const host = match[2];
  if(!host || host === 'localhost' && trimmed.startsWith('mongodb+srv://')){
    throw new Error('DATABASE_URL missing valid MongoDB Atlas host');
  }
  if(host === '...'){
    throw new Error('DATABASE_URL still contains placeholder host "...". Update it with your Atlas cluster hostname.');
  }
}
