import { z } from 'zod';
import { CATEGORIES, type Category } from '../types';

export const SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851'];
export const MEMORY_TYPES = ['DDR4', 'DDR5'];
export const FORM_FACTORS = ['ATX', 'mATX', 'ITX'];
export const STORAGE_TYPES = ['NVMe', 'SATA SSD', 'HDD'];
export const AVAILABILITY = ['in stock', 'out of stock', 'not tracked'];

// Every numeric field is held as text, because that is what an input gives
// back. One helper builds the message so "at least 1" and "from 0 to 100" read
// the same way wherever they appear.
function numberProblem(raw: string, min: number, max?: number, whole = false) {
  const value = Number(raw);
  const valid = raw.trim() !== '' && Number.isFinite(value) && value >= min
    && (max === undefined || value <= max) && (!whole || Number.isSafeInteger(value));
  if (valid) return null;
  return 'Enter ' + (whole ? 'a whole number' : 'a number')
    + (max === undefined ? ' of at least ' + min : ' from ' + min + ' to ' + max) + '.';
}

function httpsUrl(value: string) {
  if (!value.startsWith('https://')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function localImagePath(value: string) {
  const prefix = '/images/components/';
  return value.startsWith(prefix) && value.length > prefix.length
    && !/[\\\s]/.test(value) && !value.split(/[/?#]/).includes('..');
}

const base = z.object({
  category: z.string(),
  name: z.string().trim().min(1, 'Enter a component name.').max(120),
  brand: z.string().trim().min(1, 'Enter a brand.').max(120),
  price: z.string(),
  performanceScore: z.string(),
  powerDraw: z.string(),
  stock: z.string(),
  availability: z.string(),
  socket: z.string(),
  memoryType: z.string(),
  formFactor: z.string(),
  memorySlots: z.string(),
  capacityGb: z.string(),
  storageType: z.string(),
  wattageRating: z.string(),
  supportedFormFactors: z.array(z.string()),
  imageUrl: z.string().trim().max(2000),
  imageSource: z.string().trim().max(2000),
  imageCaption: z.string().trim().max(200)
});

// Which specifications a part needs depends on what kind of part it is, so the
// rules are checked together rather than field by field. A processor needs a
// socket, a case needs the board sizes it fits, and neither needs the other's.
export const componentSchema = base.superRefine((values, context) => {
  const fail = (path: keyof typeof values, message: string) =>
    context.addIssue({ code: 'custom', path: [path], message });
  const number = (path: 'price' | 'performanceScore' | 'powerDraw' | 'stock' | 'memorySlots' | 'capacityGb' | 'wattageRating',
    min: number, max?: number, whole = false) => {
    const problem = numberProblem(values[path], min, max, whole);
    if (problem) fail(path, problem);
  };
  const choice = (path: 'availability' | 'socket' | 'memoryType' | 'formFactor' | 'storageType',
    allowed: string[], message: string) => {
    if (!allowed.includes(values[path])) fail(path, message);
  };

  if (!CATEGORIES.includes(values.category as Category)) fail('category', 'Choose a category.');

  number('price', 0);
  number('performanceScore', 0, 100);
  number('powerDraw', 0);
  number('stock', 0, undefined, true);
  choice('availability', AVAILABILITY, 'Choose an availability status.');

  if (values.category === 'cpu' || values.category === 'motherboard') {
    choice('socket', SOCKETS, 'Choose a supported socket.');
  }
  if (values.category === 'motherboard' || values.category === 'memory') {
    choice('memoryType', MEMORY_TYPES, 'Choose a memory type.');
  }
  if (values.category === 'motherboard') {
    choice('formFactor', FORM_FACTORS, 'Choose a motherboard size.');
    number('memorySlots', 1, undefined, true);
  }
  if (values.category === 'memory' || values.category === 'storage') number('capacityGb', 1);
  if (values.category === 'storage') choice('storageType', STORAGE_TYPES, 'Choose a storage type.');
  if (values.category === 'psu') number('wattageRating', 1);
  if (values.category === 'case' && !values.supportedFormFactors.length) {
    fail('supportedFormFactors', 'Choose at least one supported motherboard size.');
  }

  if (values.imageUrl && !localImagePath(values.imageUrl) && !httpsUrl(values.imageUrl)) {
    fail('imageUrl', 'Use an HTTPS image URL or a valid /images/components/ path.');
  }
  if (values.imageSource && !httpsUrl(values.imageSource)) {
    fail('imageSource', 'Use a valid HTTPS source URL.');
  }
});

export type ComponentFormValues = z.infer<typeof componentSchema>;

export const EMPTY_COMPONENT: ComponentFormValues = {
  category: 'cpu', name: '', brand: '', price: '', performanceScore: '', powerDraw: '0',
  stock: '0', availability: 'not tracked', socket: '', memoryType: '', formFactor: '',
  memorySlots: '', capacityGb: '', storageType: '', wattageRating: '',
  supportedFormFactors: [], imageUrl: '', imageSource: '', imageCaption: ''
};

// Specifications the chosen category does not use are left out rather than sent
// as empty strings, because the server rejects fields a category cannot have.
export function toComponentPayload(values: ComponentFormValues) {
  const payload: Record<string, unknown> = {
    name: values.name, brand: values.brand, category: values.category,
    price: Number(values.price), performanceScore: Number(values.performanceScore),
    powerDraw: Number(values.powerDraw), stock: Number(values.stock),
    availability: values.availability, imageUrl: values.imageUrl,
    imageSource: values.imageSource, imageCaption: values.imageCaption
  };
  if (values.category === 'cpu' || values.category === 'motherboard') payload.socket = values.socket;
  if (values.category === 'memory' || values.category === 'motherboard') payload.memoryType = values.memoryType;
  if (values.category === 'motherboard') {
    payload.formFactor = values.formFactor;
    payload.memorySlots = Number(values.memorySlots);
  }
  if (values.category === 'memory' || values.category === 'storage') payload.capacityGb = Number(values.capacityGb);
  if (values.category === 'storage') payload.storageType = values.storageType;
  if (values.category === 'case') payload.supportedFormFactors = values.supportedFormFactors;
  if (values.category === 'psu') payload.wattageRating = Number(values.wattageRating);
  return payload;
}