import { z } from 'zod';

export const MARGIN_CODE = 'PSU_WATTAGE_HEADROOM';

// The four hard checks share one shape, but only the power check carries a
// margin, so the code decides whether that field is required.
export const checkSchema = z.object({
  code: z.string(),
  label: z.string().trim()
    .min(1, 'Enter a short name up to 80 characters.')
    .max(80, 'Enter a short name up to 80 characters.'),
  message: z.string().trim()
    .min(1, 'Enter the customer message, up to 300 characters.')
    .max(300, 'Enter the customer message, up to 300 characters.'),
  marginPercent: z.string()
}).superRefine((values, context) => {
  if (values.code !== MARGIN_CODE) return;
  const margin = Number(values.marginPercent);
  if (!values.marginPercent.trim() || !Number.isFinite(margin) || margin < 0 || margin > 100) {
    context.addIssue({ code: 'custom', path: ['marginPercent'], message: 'Enter a margin from 0 to 100 percent.' });
  }
});

export type CheckFormValues = z.infer<typeof checkSchema>;

export function toCheckPayload(values: CheckFormValues) {
  return {
    label: values.label,
    message: values.message,
    ...(values.code === MARGIN_CODE ? { marginPercent: Number(values.marginPercent) } : {})
  };
}

// A balance pair compares two categories, so the second one is only wrong in
// relation to the first.
export const pairSchema = z.object({
  categoryA: z.string(),
  categoryB: z.string(),
  maxGap: z.string()
}).superRefine((values, context) => {
  if (values.categoryA === values.categoryB) {
    context.addIssue({ code: 'custom', path: ['categoryB'], message: 'Compare two different categories.' });
  }
  const gap = Number(values.maxGap);
  if (!values.maxGap.trim() || !Number.isFinite(gap) || gap < 0 || gap > 100) {
    context.addIssue({ code: 'custom', path: ['maxGap'], message: 'Enter a score gap from 0 to 100.' });
  }
});

export type PairFormValues = z.infer<typeof pairSchema>;

export function toPairPayload(values: PairFormValues) {
  return { categoryA: values.categoryA, categoryB: values.categoryB, maxGap: Number(values.maxGap) };
}