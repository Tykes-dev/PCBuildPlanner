import mongoose from 'mongoose';

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'completed'];
export const ACTIVE_REQUEST_STATUSES = ['pending', 'approved'];
const itemSnapshot = new mongoose.Schema({
  // Written only from the server's allowlisted current catalog snapshot.
  component: { type: mongoose.Schema.Types.Mixed, required: true },
  quantity: { type: Number, required: true, min: 1, max: 32 }
}, { _id: false });
const requestSnapshot = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  budget: { type: Number, required: true, min: 0 },
  profileSlug: { type: String, required: true },
  items: { type: [itemSnapshot], required: true },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });
const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  build: { type: mongoose.Schema.Types.ObjectId, ref: 'Build', required: true },
  status: { type: String, enum: REQUEST_STATUSES, default: 'pending', required: true },
  active: { type: Boolean, default: true, required: true,
    validate: { validator: function (value) { return value === ACTIVE_REQUEST_STATUSES.includes(this.status); }, message: 'Active requests must be pending or approved.' } },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  remarks: { type: String, trim: true, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  snapshot: { type: requestSnapshot, required: true, immutable: true }
}, { timestamps: true });
schema.index({ owner: 1, build: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ owner: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
export default mongoose.model('BuildRequest', schema);

