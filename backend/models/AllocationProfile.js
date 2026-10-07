import mongoose from 'mongoose';
import { CATEGORIES } from './Component.js';
const allocation = new mongoose.Schema({ category: { type: String, enum: CATEGORIES, required: true },
  percent: { type: Number, min: 0, max: 100, required: true }, priority: { type: Number, min: 1, max: 7, required: true } }, { _id: false });
const minimum = new mongoose.Schema({ category: { type: String, enum: ['memory', 'storage'], required: true },
  field: { type: String, enum: ['capacityGb'], default: 'capacityGb' }, operator: { type: String, enum: ['gte'], default: 'gte' },
  value: { type: Number, min: 1, required: true } }, { _id: false });
const schema = new mongoose.Schema({ slug: { type: String, required: true, unique: true, match: /^[a-z0-9-]+$/ },
  label: { type: String, required: true }, description: { type: String, default: '' },
  allocations: { type: [allocation], validate: { validator: rows => rows.length === 7 && new Set(rows.map(r => r.category)).size === 7
    && new Set(rows.map(r => r.priority)).size === 7 && rows.every(r => Number.isInteger(r.priority))
    && Math.abs(rows.reduce((s, r) => s + r.percent, 0) - 100) < 0.000001, message: 'Provide all seven categories, unique priorities 1–7, and percentages totaling 100.' } },
  minimums: { type: [minimum], default: [] }, isDefault: { type: Boolean, default: false }, active: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });
export default mongoose.model('AllocationProfile', schema);
