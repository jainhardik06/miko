import mongoose from 'mongoose';

const SpeciesSchema = new mongoose.Schema({
  scientificName: { type: String, required: true, trim: true, unique: true },
  commonName: { type: String, required: true, trim: true, unique: true },
  sequestration: {
    low: { type: Number },
    baseline: { type: Number },
    high: { type: Number },
  },
  notes: { type: String },
}, { timestamps: true });

export const Species = mongoose.model('Species', SpeciesSchema);
