import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  component: { type: mongoose.Schema.Types.ObjectId, ref: 'Component', required: true },
  quantity: { type: Number, required: true, min: 1, max: 32, validate: Number.isSafeInteger },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true }
}, { _id: false });

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  budget: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  profile: { type: mongoose.Schema.Types.ObjectId, ref: 'AllocationProfile', required: true },
  profileSlug: { type: String, required: true },
  items: { type: [itemSchema], default: [], validate: rows => rows.length <= 7 },
  total: { type: Number, required: true, min: 0 },
  // Builds the shop makes: proposals answering an inquiry, and showcase builds.
  // They are kept out of customer activity counts.
  shopBuild: { type: Boolean, default: false },
  visibility: { type: String, enum: ['private', 'published'], default: 'private' },
  // A photo of a finished unit, shown on the landing page. Set when the build
  // is published, so an inquiry proposal never carries one.
  imageUrl: { type: String, default: '', maxlength: 2000 }
}, { timestamps: true });

schema.index({ owner: 1, updatedAt: -1 });
schema.index({ visibility: 1, updatedAt: -1 });
export default mongoose.model('Build', schema);