import { z } from 'zod';
export const recommendationSchema = z.object({ budget: z.number().int('Use a whole-peso amount.').min(1, 'Enter a positive budget.').max(10000000, 'Maximum budget is ₱10,000,000.'), profileSlug: z.string().min(1, 'Choose a use case.') });
export type RecommendationInput = z.infer<typeof recommendationSchema>;
