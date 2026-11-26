import { z } from 'zod';
import { UserRole } from './enums';

export const PASSWORD_MIN_LENGTH = 8;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(128)
  .regex(/[A-Za-z]/, 'Debe tener al menos una letra')
  .regex(/\d/, 'Debe tener al menos un número');

/** Al registrarse solo se puede ser conductor o aliado; los admin se crean por seed. */
export const SELF_SIGNUP_ROLES = [UserRole.DRIVER, UserRole.PARTNER] as const;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d{7,15}$/)
    .optional(),
  role: z.enum(SELF_SIGNUP_ROLES),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  phone: z.string().nullable(),
  role: z.enum(UserRole),
});
export type AuthUser = z.infer<typeof authUserSchema>;
