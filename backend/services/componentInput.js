import { CATEGORIES } from '../models/Component.js';
import { badRequest } from './errors.js';

const compatibilityFields = {
  cpu: ['socket'],
  motherboard: ['socket', 'memoryType', 'formFactor', 'memorySlots'],
  memory: ['memoryType', 'capacityGb'],
  gpu: [],
  storage: ['storageType', 'capacityGb'],
  case: ['supportedFormFactors'],
  psu: ['wattageRating']
};
const generalFields = ['name', 'brand', 'category', 'price', 'performanceScore', 'stock', 'availability', 'powerDraw', 'imageUrl', 'imageSource', 'imageCaption'];
const allowedFields = new Set([...generalFields, ...Object.values(compatibilityFields).flat()]);
const enums = {
  category: CATEGORIES,
  availability: ['in stock', 'out of stock', 'not tracked'],
  socket: ['AM4', 'AM5', 'LGA1700', 'LGA1851'],
  memoryType: ['DDR4', 'DDR5'],
  formFactor: ['ATX', 'mATX', 'ITX'],
  storageType: ['NVMe', 'SATA SSD', 'HDD']
};
const numbers = {
  price: { min: 0 },
  performanceScore: { min: 0, max: 100 },
  stock: { min: 0, integer: true },
  powerDraw: { min: 0 },
  wattageRating: { min: 1 },
  capacityGb: { min: 1 },
  memorySlots: { min: 1, integer: true }
};

export function componentInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a component object.');
  const fields = Object.create(null);
  const cleaned = Object.create(null);
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) fields[key] = 'This field is not supported.';
  }
  const categoryFields = CATEGORIES.includes(body.category) ? compatibilityFields[body.category] : [];
  const required = new Set(['name', 'brand', 'category', 'price', 'performanceScore', ...categoryFields]);
  for (const field of required) {
    if (!Object.hasOwn(body, field)) fields[field] = 'This field is required.';
  }
  for (const [field, limit] of Object.entries({ name: 120, brand: 120, imageUrl: 2000, imageSource: 2000, imageCaption: 200 })) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string') { fields[field] = 'Use text for this field.'; continue; }
    const value = body[field].trim();
    if ((['name', 'brand'].includes(field) && !value) || value.length > limit) {
      fields[field] = ['name', 'brand'].includes(field) ? `Enter text up to ${limit} characters.` : `Use up to ${limit} characters.`;
    } else cleaned[field] = value;
  }
  if (cleaned.imageUrl && !validImageUrl(cleaned.imageUrl)) fields.imageUrl = 'Use a local /images/components/ path or a valid HTTPS image URL.';
  if (cleaned.imageSource && !validHttpsUrl(cleaned.imageSource)) fields.imageSource = 'Use a valid HTTPS source URL.';
  for (const [field, values] of Object.entries(enums)) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || !values.includes(body[field])) fields[field] = `Choose one of: ${values.join(', ')}.`;
    else cleaned[field] = body[field];
  }
  for (const [field, rule] of Object.entries(numbers)) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || (rule.max !== undefined && value > rule.max) || (rule.integer && !Number.isSafeInteger(value))) {
      fields[field] = `Enter a ${rule.integer ? 'whole ' : ''}number ${rule.max !== undefined ? `from ${rule.min} to ${rule.max}` : `at least ${rule.min}`}.`;
    } else cleaned[field] = value;
  }
  if (Object.hasOwn(body, 'supportedFormFactors')) {
    const value = body.supportedFormFactors;
    if (!Array.isArray(value) || !value.length || value.length > 3 || value.some(size => !enums.formFactor.includes(size)) || new Set(value).size !== value.length) {
      fields.supportedFormFactors = 'Choose one or more distinct board sizes: ATX, mATX, ITX.';
    } else cleaned.supportedFormFactors = [...value];
  }
  if (Object.keys(fields).length) throw badRequest('Please check the component fields.', fields);
  const result = { stock: 0, availability: 'not tracked', powerDraw: 0, imageUrl: '', imageSource: '', imageCaption: '', archived: false };
  for (const field of [...generalFields, ...categoryFields]) {
    if (Object.hasOwn(cleaned, field)) result[field] = cleaned[field];
  }
  return result;
}

function validImageUrl(value) {
  if (value.startsWith('/images/components/')) return value.length > '/images/components/'.length && !/[\\\s]/.test(value) && !value.split(/[/?#]/).includes('..');
  return validHttpsUrl(value);
}

export function validHttpsUrl(value) {
  if (!value.startsWith('https://')) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}