import { z } from 'zod';
import { emailSchema, passwordSchema, personNameSchema, phoneSchema } from './fields';
import { BookingStatus, ParkingLotStatus, PaymentStatus, UserRole } from './enums';
import { parkingLotSchema } from './parking';

/** Paginación y búsqueda de texto de los listados del panel. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});

export const pageMetaSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

// ---------- Usuarios ----------

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  role: z.enum(UserRole),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListQuerySchema = pageQuerySchema.extend({
  role: z.enum(UserRole).optional(),
});
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const adminUserPageSchema = pageMetaSchema.extend({ items: z.array(adminUserSchema) });
export type AdminUserPage = z.infer<typeof adminUserPageSchema>;

/** El admin sí puede crear otros admin (el registro público no). */
export const adminUserCreateSchema = z.object({
  fullName: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: z.enum(UserRole),
});
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;

export const adminUserUpdateSchema = z.object({
  fullName: personNameSchema.optional(),
  phone: phoneSchema.nullable().optional(),
  role: z.enum(UserRole).optional(),
  isActive: z.boolean().optional(),
  /** Si llega, reemplaza la contraseña y cierra las sesiones abiertas. */
  password: passwordSchema.optional(),
});
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

// ---------- Parqueaderos ----------

export const adminParkingLotSchema = parkingLotSchema.extend({
  partner: z.object({ id: z.uuid(), fullName: z.string(), email: z.string() }),
  createdAt: z.iso.datetime(),
});
export type AdminParkingLot = z.infer<typeof adminParkingLotSchema>;

export const adminParkingLotListQuerySchema = pageQuerySchema.extend({
  status: z.enum(ParkingLotStatus).optional(),
});
export type AdminParkingLotListQuery = z.infer<typeof adminParkingLotListQuerySchema>;

export const adminParkingLotPageSchema = pageMetaSchema.extend({
  items: z.array(adminParkingLotSchema),
});
export type AdminParkingLotPage = z.infer<typeof adminParkingLotPageSchema>;

/** Aprobar (ACTIVE + verificado), suspender o devolver a verificación. */
export const adminParkingLotReviewSchema = z.object({
  status: z.enum(ParkingLotStatus),
  verified: z.boolean().optional(),
});
export type AdminParkingLotReviewInput = z.infer<typeof adminParkingLotReviewSchema>;

// ---------- Pagos ----------

export const adminPaymentSchema = z.object({
  id: z.uuid(),
  status: z.enum(PaymentStatus),
  amountMinor: z.number().int(),
  commissionMinor: z.number().int(),
  currency: z.string().length(3),
  providerRef: z.string(),
  createdAt: z.iso.datetime(),
  booking: z.object({
    id: z.uuid(),
    status: z.enum(BookingStatus),
    plate: z.string(),
    parkingLotName: z.string(),
    driverName: z.string(),
    driverEmail: z.string(),
  }),
});
export type AdminPayment = z.infer<typeof adminPaymentSchema>;

export const adminPaymentListQuerySchema = pageQuerySchema.extend({
  status: z.enum(PaymentStatus).optional(),
});
export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>;

export const adminPaymentPageSchema = pageMetaSchema.extend({ items: z.array(adminPaymentSchema) });
export type AdminPaymentPage = z.infer<typeof adminPaymentPageSchema>;

// ---------- Estadísticas ----------

export const dailyRevenueSchema = z.object({
  /** Día en APP_TIMEZONE, formato YYYY-MM-DD. */
  date: z.string(),
  grossMinor: z.number().int(),
  count: z.number().int(),
});
export type DailyRevenue = z.infer<typeof dailyRevenueSchema>;

export const revenueSummarySchema = z.object({
  grossMinor: z.number().int(),
  commissionMinor: z.number().int(),
  currency: z.string().length(3),
  daily: z.array(dailyRevenueSchema),
});
export type RevenueSummary = z.infer<typeof revenueSummarySchema>;

export const adminStatsSchema = z.object({
  users: z.object({ total: z.number().int(), byRole: z.record(z.enum(UserRole), z.number()) }),
  parkingLots: z.object({
    total: z.number().int(),
    byStatus: z.record(z.enum(ParkingLotStatus), z.number()),
  }),
  bookings: z.object({
    total: z.number().int(),
    byStatus: z.record(z.enum(BookingStatus), z.number()),
  }),
  revenue: revenueSummarySchema,
  /** Ocupación global: cupos vendidos / cupos publicados (0–1). */
  occupancy: z.number().min(0).max(1),
  /** false si la API no tiene llave de Stripe configurada. */
  paymentsEnabled: z.boolean(),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

// ---------- Parámetros de negocio ----------

export const adminSettingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string(),
  updatedAt: z.iso.datetime(),
});
export type AdminSetting = z.infer<typeof adminSettingSchema>;

/** El valor se valida en la API contra `settingsSchemas[key]`. */
export const adminSettingUpdateSchema = z.object({ value: z.unknown() });
export type AdminSettingUpdateInput = z.infer<typeof adminSettingUpdateSchema>;
