import { z } from 'zod';

// The budget arrives as text from the input, so it is checked as text and
// converted once it is known to be a whole peso amount. The server applies the
// same three rules when the inquiry reaches it.
export const inquirySchema = z.object({
  useCase: z.string().trim()
    .min(1, 'Say what you will use the PC for, up to 120 characters.')
    .max(120, 'Say what you will use the PC for, up to 120 characters.'),
  budget: z.string().refine(raw => {
    const amount = Number(raw);
    return raw.trim() !== '' && Number.isSafeInteger(amount) && amount > 0;
  }, 'Enter a whole-peso budget above zero.'),
  details: z.string().trim().max(1000, 'Keep the extra details under 1,000 characters.')
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;

export function toInquiryPayload(values: InquiryFormValues) {
  return { useCase: values.useCase, budget: Number(values.budget), details: values.details };
}