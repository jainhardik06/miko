import mongoose from 'mongoose';

// Stores hashed OTP codes with short TTL. We never store raw codes.
// Index on identifier + expiresAt for fast cleanup.
const OtpSchema = new mongoose.Schema({
  identifier: { type:String, required:true, index:true }, // email (lowercased)
  codeHash: { type:String, required:true },
  salt: { type:String, required:true },
  attempts: { type:Number, default:0 },
  maxAttempts: { type:Number, default:5 },
  expiresAt: { type:Date, required:true, index:true },
  consumedAt: { type:Date }
}, { timestamps:true });

OtpSchema.index({ identifier:1, expiresAt:1 });

export default mongoose.models.Otp || mongoose.model('Otp', OtpSchema);
