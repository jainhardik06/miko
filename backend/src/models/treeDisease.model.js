import mongoose from 'mongoose';

const TreeDiseaseSchema = new mongoose.Schema({
  // Either link to a created Tree or to a pending TreeSubmission
  treeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tree' },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreeSubmission' },
  name: { type: String, required: true, trim: true },
  appearance: { type: String, trim: true },
  photoUrl: { type: String }, // store URL to uploaded image (S3, Cloudinary, etc.)
}, { timestamps: true });

export const TreeDisease = mongoose.model('TreeDisease', TreeDiseaseSchema);
