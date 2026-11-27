import { z } from 'zod';
import { BookingStatus, PaymentStatus, PayoutAccountStatus, Shift, VehicleType } from './enums';
import { revenueSummarySchema } from './admin';
import { registerSchema } from './auth';
import { plateSchema } from './parking';

/** Reservar una mensualidad: cupo elegido (franja + vehículo) y placa del vehículo. */
export const createBookingSchema = z.object({
  offerId: z.uuid(),
  plate: plateSchema,
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Reservar sin cuenta (ficha del parqueadero): en un solo paso se crea la cuenta de conductor
 * y se aparta el cupo. Reutiliza las reglas del registro y de la placa.
 */
export const guestBookingSchema = registerSchema
  .pick({ fullName: true, email: true, password: true })
  .extend({ plate: plateSchema });
export type GuestBookingInput = z.infer<typeof guestBookingSchema>;

export const bookingSchema = z.object({
  id: z.uuid(),
  status: z.enum(BookingStatus),
  shift: z.enum(Shift),
  vehicleType: z.enum(VehicleType),
  plate: z.string(),
  priceMinor: z.number().int(),
  currency: z.string().length(3),
  /** Código que se muestra al ingresar al parqueadero (se genera al confirmar el pago). */
  accessCode: z.string().nullable(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** Si es una renovación: la mensualidad que continúa (empieza cuando esa termina). */
  renewalOfId: z.uuid().nullable(),
  parkingLot: z.object({ id: z.uuid(), name: z.string(), address: z.string() }),
});
export type Booking = z.infer<typeof bookingSchema>;

/** Respuesta al crear la reserva: datos para el Payment Element de Stripe. */
export const bookingCheckoutSchema = z.object({
  booking: bookingSchema,
  /** null si la reserva ya no está pendiente de pago. */
  clientSecret: z.string().nullable(),
});
export type BookingCheckout = z.infer<typeof bookingCheckoutSchema>;

/** Reserva vista por el aliado: incluye a quién pertenece. */
export const partnerBookingSchema = bookingSchema.extend({
  driverName: z.string(),
});
export type PartnerBooking = z.infer<typeof partnerBookingSchema>;

/** Resumen del panel del aliado (pantalla 7): cupos, ocupación e ingresos netos. */
export const partnerSummarySchema = z.object({
  lots: z.number().int(),
  totalSpots: z.number().int(),
  availableSpots: z.number().int(),
  bookings: z.object({ active: z.number().int(), pending: z.number().int() }),
  revenue: revenueSummarySchema.extend({ netMinor: z.number().int() }),
  recentBookings: z.array(partnerBookingSchema),
});
export type PartnerSummary = z.infer<typeof partnerSummarySchema>;

/** Recibo de una mensualidad pagada (pantalla 5): soporte para el conductor y la portería. */
export const bookingReceiptSchema = z.object({
  /** Número legible del recibo, p. ej. PV-1A2B3C4D. */
  number: z.string(),
  booking: bookingSchema,
  driver: z.object({ fullName: z.string(), email: z.string() }),
  payment: z.object({
    provider: z.string(),
    reference: z.string(),
    amountMinor: z.number().int(),
    currency: z.string().length(3),
    status: z.enum(PaymentStatus),
    paidAt: z.iso.datetime().nullable(),
  }),
  issuedAt: z.iso.datetime(),
});
export type BookingReceipt = z.infer<typeof bookingReceiptSchema>;

/** Cuenta de pagos del aliado (Stripe Connect). `status` null = aún no la conecta. */
export const payoutAccountSchema = z.object({
  /** false si la plataforma no tiene pagos configurados. */
  paymentsEnabled: z.boolean(),
  status: z.enum(PayoutAccountStatus).nullable(),
});
export type PayoutAccount = z.infer<typeof payoutAccountSchema>;

/** Enlace de un solo uso a la pasarela (onboarding o panel de la cuenta conectada). */
export const providerLinkSchema = z.object({ url: z.url() });
export type ProviderLink = z.infer<typeof providerLinkSchema>;
