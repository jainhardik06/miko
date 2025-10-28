import mongoose from 'mongoose';

const WalletSubSchema = new mongoose.Schema({
  address: { type:String, required:true },
  network: { type:String, enum:['aptos','evm'], required:true },
  publicKey: String,
  addedAt: { type:Date, default:Date.now }
}, { _id:false });

const CorporateProfileSchema = new mongoose.Schema({
  companyName: String,
  cin: String,
  gstin: String,
  verificationStatus: { type:String, enum:['NONE','PENDING','VERIFIED','REJECTED'], default:'NONE' },
  submittedAt: Date,
  verifiedAt: Date
}, { _id:false });

const UserSchema = new mongoose.Schema({
  username: { type:String, unique:true, sparse:true },
  role: { type:String, enum:['INDIVIDUAL','CORPORATE','VALIDATOR','ADMIN'], default:'INDIVIDUAL' },
  email: { type:String, lowercase:true, index:true },
  authMethods: {
    google: {
      googleId: String,
      email: String
    },
    wallets: [WalletSubSchema],
    passwordless: { // OTP/email based
      email: String,
      lastLoginAt: Date
    }
  },
  corporateProfile: CorporateProfileSchema,
  stats: {
    treesApproved: { type: Number, default: 0 },
    treesPending: { type: Number, default: 0 },
    treesRejected: { type: Number, default: 0 },
    totalCCT: { type: Number, default: 0 }
  },
  createdAt: { type:Date, default:Date.now },
  lastLoginAt: Date,
  meta: {
    signupSource: String
  }
}, { timestamps:true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
