import * as contracts from '@parqueavecino/contracts';
import { describe, expect, it } from 'vitest';
import * as prismaEnums from '../../generated/prisma/enums';

/** Los enums de Prisma deben ser idénticos a los de @parqueavecino/contracts (fuente única). */
describe('paridad de enums Prisma ↔ contracts', () => {
  const pairs = [
    ['UserRole', prismaEnums.UserRole, contracts.UserRole],
    ['VehicleType', prismaEnums.VehicleType, contracts.VehicleType],
    ['Shift', prismaEnums.Shift, contracts.Shift],
    ['Amenity', prismaEnums.Amenity, contracts.Amenity],
    ['ParkingLotStatus', prismaEnums.ParkingLotStatus, contracts.ParkingLotStatus],
    ['BookingStatus', prismaEnums.BookingStatus, contracts.BookingStatus],
    ['PaymentStatus', prismaEnums.PaymentStatus, contracts.PaymentStatus],
  ] as const;

  it.each(pairs)('%s coincide', (_name, prismaEnum, contractEnum) => {
    expect(Object.values(prismaEnum).sort()).toEqual(Object.values(contractEnum).sort());
  });
});
