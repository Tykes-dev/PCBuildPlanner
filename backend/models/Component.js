import mongoose from 'mongoose';
export const CATEGORIES = ['cpu', 'motherboard', 'memory', 'gpu', 'storage', 'case', 'psu'];
const requiredFor = (...categories) => function () { return categories.includes(this.category); };
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  brand: { type: String, required: true, trim: true },
  imageUrl: { type: String, default: '', maxlength: 2000, validate: { validator: value => !value || value.startsWith('/images/components/') || /^https:\/\//.test(value), message: 'Use a local component image path or HTTPS image URL.' } },
  imageSource: { type: String, default: '', maxlength: 2000 },
  imageCaption: { type: String, default: '', maxlength: 200 },
  category: { type: String, enum: CATEGORIES, required: true },
  price: { type: Number, required: true, min: 0 },
  performanceScore: { type: Number, required: true, min: 0, max: 100 },
  stock: { type: Number, min: 0, default: 0 },
  availability: { type: String, enum: ['in stock', 'out of stock', 'not tracked'], default: 'not tracked' },
  archived: { type: Boolean, default: false },
  socket: { type: String, enum: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], required: requiredFor('cpu', 'motherboard') },
  memoryType: { type: String, enum: ['DDR4', 'DDR5'], required: requiredFor('memory', 'motherboard') },
  formFactor: { type: String, enum: ['ATX', 'mATX', 'ITX'], required: requiredFor('motherboard') },
  supportedFormFactors: { type: [{ type: String, enum: ['ATX', 'mATX', 'ITX'] }], default: undefined,
    validate: { validator: function (v) { return this.category !== 'case' || Boolean(v?.length); }, message: 'A case must support at least one board size.' }, required: requiredFor('case') },
  wattageRating: { type: Number, min: 1, required: requiredFor('psu') },
  capacityGb: { type: Number, min: 1, required: requiredFor('memory', 'storage') },
  storageType: { type: String, enum: ['NVMe', 'SATA SSD', 'HDD'], required: requiredFor('storage') },
  memorySlots: { type: Number, min: 1, required: requiredFor('motherboard') },
  powerDraw: { type: Number, min: 0, default: 0 }
}, { timestamps: true, toJSON: { virtuals: true } });
schema.index({ brand: 1, name: 1 }, { unique: true });
schema.virtual('valueRatio').get(function () { return this.price ? this.performanceScore / this.price : 0; });
export default mongoose.model('Component', schema);
