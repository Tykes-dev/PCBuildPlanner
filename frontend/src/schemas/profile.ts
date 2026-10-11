import { z } from 'zod';
import { CATEGORIES, type Category } from '../types';

export const MINIMUM_CATEGORIES: Category[] = ['memory', 'storage'];
const MINIMUM_MESSAGE = 'Enter whole capacities in GB of at least 1, or leave them blank.';

const allocationRow = z.object({
  category: z.string(),
  percent: z.string(),
  priority: z.string()
});

const base = z.object({
  slug: z.string(),
  label: z.string().trim()
    .min(1, 'Enter a name up to 80 characters.')
    .max(80, 'Enter a name up to 80 characters.'),
  description: z.string().max(300, 'Use text up to 300 characters.'),
  rows: z.array(allocationRow),
  minMemory: z.string(),
  minStorage: z.string()
});

const wholeGb = (raw: string) => {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1;
};

// The seven shares are judged together, not one at a time: a single share can
// look perfectly valid while the set still fails to total 100.
export const profileSchema = base.superRefine((values, context) => {
  const fail = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message });

  const slug = values.slug.trim().toLowerCase();
  if (!slug || slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) {
    fail('slug', 'Use lowercase letters, numbers and hyphens, up to 100 characters.');
  }

  const percents = values.rows.map(row => Number(row.percent));
  const badPercent = values.rows.some((row, index) =>
    !row.percent.trim() || !Number.isFinite(percents[index]) || percents[index] < 0 || percents[index] > 100);
  const priorities = values.rows.map(row => row.priority);
  const total = percents.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

  // Reported in this order so the customer fixes the cause, not the symptom.
  if (badPercent) fail('rows', 'Each percentage must be a number from 0 to 100.');
  else if (new Set(priorities).size !== priorities.length) fail('rows', 'Use each priority from 1 to 7 exactly once.');
  else if (Math.abs(total - 100) > 0.0001) {
    fail('rows', 'The seven percentages must total 100. They currently total ' + (Math.round(total * 100) / 100) + '.');
  }

  if (values.minMemory.trim() && !wholeGb(values.minMemory.trim())) fail('minMemory', MINIMUM_MESSAGE);
  if (values.minStorage.trim() && !wholeGb(values.minStorage.trim())) fail('minStorage', MINIMUM_MESSAGE);
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

const EVEN = Math.floor(100 / CATEGORIES.length);

export function emptyProfile(): ProfileFormValues {
  return {
    slug: '', label: '', description: '', minMemory: '', minStorage: '',
    rows: CATEGORIES.map((category, index) => ({
      category,
      percent: String(index === 0 ? 100 - EVEN * (CATEGORIES.length - 1) : EVEN),
      priority: String(index + 1)
    }))
  };
}

export function toProfilePayload(values: ProfileFormValues) {
  const minimums: { category: string; value: number }[] = [];
  if (values.minMemory.trim()) minimums.push({ category: 'memory', value: Number(values.minMemory) });
  if (values.minStorage.trim()) minimums.push({ category: 'storage', value: Number(values.minStorage) });
  return {
    slug: values.slug.trim().toLowerCase(),
    label: values.label,
    description: values.description.trim(),
    allocations: values.rows.map(row => ({
      category: row.category, percent: Number(row.percent), priority: Number(row.priority)
    })),
    minimums
  };
}