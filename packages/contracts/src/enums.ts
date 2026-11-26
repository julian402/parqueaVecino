/**
 * Enums del dominio: fuente única para Prisma, API y web.
 * Se usan objetos `as const` (no `enum` de TS) para que sirvan también como valores de Zod.
 */
const values = <T extends Record<string, string>>(o: T) =>
  Object.values(o) as [T[keyof T], ...T[keyof T][]];

export const Shift = { DAY: 'DAY', NIGHT: 'NIGHT', FULL: 'FULL' } as const;
export type Shift = (typeof Shift)[keyof typeof Shift];
export const SHIFTS = values(Shift);

export const VehicleType = { CAR: 'CAR', MOTORCYCLE: 'MOTORCYCLE', BICYCLE: 'BICYCLE' } as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];
export const VEHICLE_TYPES = values(VehicleType);

export const UserRole = { DRIVER: 'DRIVER', PARTNER: 'PARTNER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const USER_ROLES = values(UserRole);

export const BookingStatus = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];
export const BOOKING_STATUSES = values(BookingStatus);

export const DocumentType = {
  LIABILITY_POLICY: 'LIABILITY_POLICY',
  RUT: 'RUT',
  E_INVOICING: 'E_INVOICING',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
export const DOCUMENT_TYPES = values(DocumentType);

export const DocumentStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
export const DOCUMENT_STATUSES = values(DocumentStatus);

export const Amenity = {
  ROOF: 'ROOF',
  SECURITY_24H: 'SECURITY_24H',
  CAMERAS: 'CAMERAS',
  BIKE_SPOT: 'BIKE_SPOT',
  EV_CHARGER: 'EV_CHARGER',
} as const;
export type Amenity = (typeof Amenity)[keyof typeof Amenity];
export const AMENITIES = values(Amenity);

export const ParkingLotStatus = {
  DRAFT: 'DRAFT',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type ParkingLotStatus = (typeof ParkingLotStatus)[keyof typeof ParkingLotStatus];
export const PARKING_LOT_STATUSES = values(ParkingLotStatus);

/** Orden de los resultados de búsqueda. */
export const SearchSort = { PRICE: 'PRICE', DISTANCE: 'DISTANCE' } as const;
export type SearchSort = (typeof SearchSort)[keyof typeof SearchSort];
export const SEARCH_SORTS = values(SearchSort);
