import { z } from 'zod';

// The rules below mirror the server checks in backend/services/auth.js so the
// form and the API agree. Both schemas describe the same four fields, which
// lets one form switch between logging in and registering.
const email = z.string().trim().toLowerCase()
  .min(1, 'Enter your email address.')
  .max(254, 'Email must be 254 characters or fewer.')
  .email('Enter a valid email address.');

export const loginSchema = z.object({
  name: z.string(),
  email,
  password: z.string().min(1, 'Enter your password.').max(128, 'Password must be 128 characters or fewer.'),
  confirmPassword: z.string()
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your full name.').max(80, 'Name must be 80 characters or fewer.'),
  email,
  password: z.string().min(12, 'Password must be at least 12 characters.').max(128, 'Password must be 128 characters or fewer.'),
  confirmPassword: z.string().min(1, 'Confirm your password.')
}).refine(values => values.password === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword']
});

export type AuthInput = z.infer<typeof registerSchema>;
export const authSchema = (registering: boolean) => registering ? registerSchema : loginSchema;