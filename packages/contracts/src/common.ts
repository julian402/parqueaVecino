import { z } from 'zod';

/** Dinero siempre en unidades menores (entero) + código ISO 4217. */
export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof moneySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Formato estándar de error que devuelve la API. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
  timestamp: z.string(),
  path: z.string(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
