import { z } from 'zod';

const email = z.string().trim().toLowerCase().min(1, 'Enter your email address.').max(254, 'Email must be 254 characters or fewer.').email('Enter a valid email address.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be 72 characters or fewer.');

export const loginSchema = z.object({ email, password });
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80, 'Name must be 80 characters or fewer.'),
  email,
  password,
  confirmPassword: z.string().min(1, 'Confirm your password.')
}).refine(input => input.password === input.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
export type RegisterInput = z.infer<typeof registerSchema>;
