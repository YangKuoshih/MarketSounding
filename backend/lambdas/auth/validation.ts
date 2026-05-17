import { z } from 'zod';

/**
 * Username: 3-50 characters, alphanumeric + underscore only
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username must contain only alphanumeric characters and underscores');

/**
 * Password: minimum 8 characters
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

/**
 * Registration/Login request body schema
 */
export const authRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export type AuthRequest = z.infer<typeof authRequestSchema>;
