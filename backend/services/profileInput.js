import { CATEGORIES } from '../models/Component.js';
import { badRequest } from './errors.js';

const MINIMUM_CATEGORIES = ['memory', 'storage'];
const allowedFields = ['slug', 'label', 'description', 'allocations', 'minimums'];

// Percentages are entered as whole numbers in the interface, but a profile is
// still valid if an administrator sends decimals, so a small tolerance is used
// on the total the same way the Mongoose validator does.
const TOTAL_TOLERANCE = 0.000001;

export function profileInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Provide a use case profile object.');
  const fields = Object.create(null);
  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) fields[key] = 'This field is not supported.';
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (!slug || slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) {
    fields.slug = 'Use lowercase letters, numbers and hyphens, up to 100 characters.';
  }

  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > 80) fields.label = 'Enter a name up to 80 characters.';

  let description = '';
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 300) fields.description = 'Use text up to 300 characters.';
    else description = body.description.trim();
  }

  const allocations = [];
  if (!Array.isArray(body.allocations) || body.allocations.length !== CATEGORIES.length) {
    fields.allocations = 'Provide one row for each of the seven categories.';
  } else {
    const categories = new Set();
    const priorities = new Set();
    let total = 0;
    for (const row of body.allocations) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) { fields.allocations = 'Each row needs a category, a percentage and a priority.'; break; }
      if (!CATEGORIES.includes(row.category) || categories.has(row.category)) { fields.allocations = 'Use each of the seven categories exactly once.'; break; }
      if (typeof row.percent !== 'number' || !Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100) { fields.allocations = 'Each percentage must be a number from 0 to 100.'; break; }
      if (!Number.isSafeInteger(row.priority) || row.priority < 1 || row.priority > CATEGORIES.length || priorities.has(row.priority)) { fields.allocations = 'Use each priority from 1 to 7 exactly once.'; break; }
      categories.add(row.category);
      priorities.add(row.priority);
      total += row.percent;
      allocations.push({ category: row.category, percent: row.percent, priority: row.priority });
    }
    if (!fields.allocations && Math.abs(total - 100) > TOTAL_TOLERANCE) {
      fields.allocations = `The seven percentages must total 100. They currently total ${Math.round(total * 100) / 100}.`;
    }
  }

  const minimums = [];
  if (body.minimums !== undefined) {
    if (!Array.isArray(body.minimums) || body.minimums.length > MINIMUM_CATEGORIES.length) {
      fields.minimums = 'Provide at most one minimum for memory and one for storage.';
    } else {
      const seen = new Set();
      for (const row of body.minimums) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) { fields.minimums = 'Each minimum needs a category and a capacity.'; break; }
        if (!MINIMUM_CATEGORIES.includes(row.category) || seen.has(row.category)) { fields.minimums = 'Minimums support memory and storage, once each.'; break; }
        if (!Number.isSafeInteger(row.value) || row.value < 1) { fields.minimums = 'Enter a whole capacity in GB of at least 1.'; break; }
        seen.add(row.category);
        minimums.push({ category: row.category, field: 'capacityGb', operator: 'gte', value: row.value });
      }
    }
  }

  if (Object.keys(fields).length) throw badRequest('Please check the use case profile fields.', fields);
  return { slug, label, description, allocations, minimums };
}

// Priority decides which category spare budget fills first, so it only makes
// sense when it agrees with the percentages. This orders them for the caller.
export function priorityFromPercent(allocations) {
  return [...allocations]
    .sort((a, b) => b.percent - a.percent || a.category.localeCompare(b.category))
    .map((row, index) => ({ ...row, priority: index + 1 }));
}