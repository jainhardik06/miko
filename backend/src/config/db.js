import mongoose from 'mongoose';

export async function connectDb(){
  const uri = process.env.DATABASE_URL;
  if(!uri) throw new Error('DATABASE_URL missing');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  console.log('Mongo connected');
}
