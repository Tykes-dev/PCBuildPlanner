import mongoose from 'mongoose';

// A BuildRequest is "here is the build I made, please approve it".
// A BuildInquiry is the opposite: "I do not know what I need, please build one
// for me". It exists for customers whose use case no profile covers, so it
// starts with no build at all and the shop supplies one.
export const INQUIRY_STATUSES = ['open', 'answered', 'accepted', 'declined', 'closed'];
export const OPEN_INQUIRY_STATUSES = ['open', 'answered'];

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  useCase: { type: String, required: true, trim: true, maxlength: 120 },
  budget: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: INQUIRY_STATUSES, default: 'open', required: true },
  // Set once the shop answers. The build belongs to the administrator until
  // the customer accepts, at which point a copy is made in their account.
  proposedBuild: { type: mongoose.Schema.Types.ObjectId, ref: 'Build' },
  acceptedBuild: { type: mongoose.Schema.Types.ObjectId, ref: 'Build' },
  reply: { type: String, trim: true, maxlength: 1000, default: '' },
  answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

schema.index({ customer: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
export default mongoose.model('BuildInquiry', schema);