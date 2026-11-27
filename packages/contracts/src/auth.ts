import { z } from 'zod';
import { UserRole } from './enums';
import { emailSchema, passwordSchema, personNameSchema, phoneSchema } from './fields';

/** Al registrarse solo se puede ser conductor o aliado; los admin se crean por seed. */
export const SELF_SIGNUP_ROLES = [UserRole.DRIVER, UserRole.PARTNER] as const;

export const registerSchema = z.object({
  fullName: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: z.enum(SELF_SIGNUP_ROLES),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña'),
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

/** Sesión actual: `user` es null si no hay sesión (no es un error). */
export const authSessionSchema = z.object({ user: authUserSchema.nullable() });
export type AuthSession = z.infer<typeof authSessionSchema>;
