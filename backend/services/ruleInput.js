import { CATEGORIES, CATEGORY_LABELS } from '../models/Component.js';
import { badRequest } from './errors.js';

// The four check codes are built into the compatibility engine, so an
// administrator can reword them and tune the power margin, but cannot add,
// remove or switch them off. A shop must not be able to sell a processor that
// does not fit its motherboard.
const CHECK_FIELDS = ['label', 'message', 'marginPercent'];
const PAIR_FIELDS = ['categoryA', 'categoryB', 'maxGap', 'active'];

export function checkInput(body, code) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a compatibility check object.');
  const fields = Object.create(null);
  for (const key of Object.keys(body)) {
    if (!CHECK_FIELDS.includes(key)) fields[key] = 'This field is not supported.';
  }
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > 80) fields.label = 'Enter a short name up to 80 characters.';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 300) fields.message = 'Enter the customer message, up to 300 characters.';

  const result = { label, message };
  if (code === 'PSU_WATTAGE_HEADROOM') {
    const margin = body.marginPercent;
    if (typeof margin !== 'number' || !Number.isFinite(margin) || margin < 0 || margin > 100) {
      fields.marginPercent = 'Enter a safety margin from 0 to 100 percent.';
    } else result.marginPercent = margin;
  } else if (body.marginPercent !== undefined) {
    fields.marginPercent = 'Only the power headroom check uses a safety margin.';
  }

  if (Object.keys(fields).length) throw badRequest('Please check the compatibility check fields.', fields);
  return result;
}

export function pairInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a balance pair object.');
  const fields = Object.create(null);
  for (const key of Object.keys(body)) {
    if (!PAIR_FIELDS.includes(key)) fields[key] = 'This field is not supported.';
  }
  if (!CATEGORIES.includes(body.categoryA)) fields.categoryA = 'Choose a category to compare.';
  if (!CATEGORIES.includes(body.categoryB)) fields.categoryB = 'Choose a second category to compare.';
  if (!fields.categoryA && !fields.categoryB && body.categoryA === body.categoryB) {
    fields.categoryB = `Compare two different categories. The ${CATEGORY_LABELS[body.categoryA]} cannot be compared with itself.`;
  }
  if (typeof body.maxGap !== 'number' || !Number.isFinite(body.maxGap) || body.maxGap < 0 || body.maxGap > 100) {
    fields.maxGap = 'Enter a score gap from 0 to 100.';
  }
  if (body.active !== undefined && typeof body.active !== 'boolean') fields.active = 'Active must be true or false.';

  if (Object.keys(fields).length) throw badRequest('Please check the balance pair fields.', fields);
  return {
    categoryA: body.categoryA, categoryB: body.categoryB,
    maxGap: body.maxGap, active: body.active === undefined ? true : body.active
  };
}