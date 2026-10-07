import mongoose from 'mongoose';
export const CHECK_CODES = ['CPU_SOCKET_MATCH', 'MEMORY_TYPE_MATCH', 'CASE_FITS_BOARD', 'PSU_WATTAGE_HEADROOM'];
const schema = new mongoose.Schema({ code: { type: String, required: true, unique: true, enum: CHECK_CODES },
  label: { type: String, required: true }, message: { type: String, required: true },
  marginPercent: { type: Number, min: 0, max: 100, required: function () { return this.code === 'PSU_WATTAGE_HEADROOM'; } },
  active: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('CheckSetting', schema);
