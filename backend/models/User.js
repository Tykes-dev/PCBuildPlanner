import mongoose from 'mongoose';

export const USER_ROLES = ['customer', 'admin'];

function removePrivateFields(doc, result) {
  delete result.passwordHash;
  delete result.__v;
  return result;
}

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, default: 'customer', required: true },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null }
}, {
  timestamps: true,
  toJSON: { transform: removePrivateFields },
  toObject: { transform: removePrivateFields }
});

export default mongoose.model('User', schema);
