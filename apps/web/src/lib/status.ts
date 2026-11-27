import type {
  BookingStatus,
  DocumentStatus,
  ParkingLotStatus,
  PaymentStatus,
} from '@parqueavecino/contracts';
import type { BadgeProps } from '@parqueavecino/ui';

type Tone = NonNullable<BadgeProps['tone']>;

/** Color de la etiqueta de cada estado (el texto sale de los mensajes). */
export const BOOKING_STATUS_TONE: Record<BookingStatus, Tone> = {
  PENDING_PAYMENT: 'warning',
  ACTIVE: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  REFUNDED: 'ink',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REFUNDED: 'ink',
};

export const LOT_STATUS_TONE: Record<ParkingLotStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING_VERIFICATION: 'warning',
  ACTIVE: 'success',
  PAUSED: 'neutral',
  SUSPENDED: 'danger',
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, Tone> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'danger',
};
