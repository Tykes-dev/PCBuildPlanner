import mongoose from 'mongoose';
import { CATEGORIES } from './Component.js';
const schema = new mongoose.Schema({ categoryA: { type: String, enum: CATEGORIES, required: true },
  categoryB: { type: String, enum: CATEGORIES, required: true }, maxGap: { type: Number, required: true, min: 0, max: 100 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
schema.pre('validate', function () {
  if (this.categoryA === this.categoryB) this.invalidate('categoryB', 'Choose two different categories.');
  if (this.categoryA > this.categoryB) [this.categoryA, this.categoryB] = [this.categoryB, this.categoryA];
});
schema.index({ categoryA: 1, categoryB: 1 }, { unique: true });
export default mongoose.model('BalancePair', schema);
