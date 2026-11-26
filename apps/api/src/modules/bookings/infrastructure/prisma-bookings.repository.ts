import { Injectable } from '@nestjs/common';
import {
  BOOKING_STATUSES,
  type BookingStatus,
  type PartnerBooking,
} from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  BookingsRepository,
  type BookingActivation,
  type BookingRecord,
  type NewBooking,
} from '../domain/bookings.repository';

const include = {
  parkingLot: { select: { id: true, name: true, address: true } },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof include }>;

function toRecord(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    driverId: row.driverId,
    offerId: row.offerId,
    status: row.status,
    shift: row.shift,
    vehicleType: row.vehicleType,
    plate: row.plate,
    priceMinor: row.priceMinor,
    currency: row.currency,
    accessCode: row.accessCode,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    renewalOfId: row.renewalOfId,
    parkingLot: row.parkingLot,
  };
}

@Injectable()
export class PrismaBookingsRepository extends BookingsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: NewBooking): Promise<BookingRecord> {
    return toRecord(await this.prisma.booking.create({ data, include }));
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const row = await this.prisma.booking.findUnique({ where: { id }, include });
    return row ? toRecord(row) : null;
  }

  async listByDriver(driverId: string): Promise<BookingRecord[]> {
    const rows = await this.prisma.booking.findMany({
      where: { driverId },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async findOpenRenewal(bookingId: string): Promise<BookingRecord | null> {
    const row = await this.prisma.booking.findFirst({
      where: { renewalOfId: bookingId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return row ? toRecord(row) : null;
  }

  async transition(
    id: string,
    from: BookingStatus[],
    to: BookingStatus,
    activation?: BookingActivation,
  ): Promise<boolean> {
    const { count } = await this.prisma.booking.updateMany({
      where: { id, status: { in: from } },
      data: { status: to, ...activation },
    });
    return count > 0;
  }

  async findStalePending(createdBefore: Date): Promise<BookingRecord[]> {
    const rows = await this.prisma.booking.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: createdBefore } },
      include,
      take: 100,
    });
    return rows.map(toRecord);
  }

  async findEndedActive(now: Date): Promise<BookingRecord[]> {
    const rows = await this.prisma.booking.findMany({
      where: { status: 'ACTIVE', endsAt: { lt: now } },
      include,
      take: 100,
    });
    return rows.map(toRecord);
  }

  async countByStatus(partnerId?: string): Promise<Record<BookingStatus, number>> {
    const rows = await this.prisma.booking.groupBy({
      by: ['status'],
      where: partnerId ? { parkingLot: { partnerId } } : {},
      _count: { _all: true },
    });
    const counts = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<
      BookingStatus,
      number
    >;
    for (const row of rows) counts[row.status] = row._count._all;
    return counts;
  }

  async recentForPartner(partnerId: string, limit: number): Promise<PartnerBooking[]> {
    const rows = await this.prisma.booking.findMany({
      where: { parkingLot: { partnerId }, status: { not: 'PENDING_PAYMENT' } },
      include: { ...include, driver: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => {
      const { driverId: _d, offerId: _o, ...booking } = toRecord(row);
      return { ...booking, driverName: row.driver.fullName };
    });
  }
}
