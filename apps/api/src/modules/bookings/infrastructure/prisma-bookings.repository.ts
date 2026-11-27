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
  type ExpiringBooking,
  type NewBooking,
  type OccupancyInterval,
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

  async findExpiringWithoutNotice(now: Date, until: Date): Promise<ExpiringBooking[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: 'ACTIVE',
        expiryNoticeSentAt: null,
        endsAt: { gte: now, lte: until },
        renewals: { none: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        plate: true,
        endsAt: true,
        parkingLot: { select: { name: true } },
        driver: { select: { email: true, fullName: true } },
      },
      take: 100,
    });
    return rows.flatMap((row) =>
      row.endsAt
        ? [
            {
              id: row.id,
              plate: row.plate,
              endsAt: row.endsAt,
              parkingLotName: row.parkingLot.name,
              driver: row.driver,
            },
          ]
        : [],
    );
  }

  async markExpiryNoticeSent(id: string, at: Date): Promise<void> {
    await this.prisma.booking.update({ where: { id }, data: { expiryNoticeSentAt: at } });
  }

  async occupancyIntervals(
    partnerId: string,
    from: Date,
    to: Date,
    parkingLotId?: string,
  ): Promise<OccupancyInterval[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        parkingLot: { partnerId, ...(parkingLotId && { id: parkingLotId }) },
        status: { in: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED'] },
        startsAt: { not: null, lt: to },
        endsAt: { gt: from },
      },
      select: { shift: true, status: true, startsAt: true, endsAt: true, updatedAt: true },
    });
    return rows.flatMap((row) => {
      if (!row.startsAt || !row.endsAt) return [];
      // Cancelada o reembolsada: dejó de ocupar el cupo cuando cambió de estado.
      const stoppedEarly = row.status === 'CANCELLED' || row.status === 'REFUNDED';
      const endsAt = stoppedEarly && row.updatedAt < row.endsAt ? row.updatedAt : row.endsAt;
      return endsAt > row.startsAt ? [{ shift: row.shift, startsAt: row.startsAt, endsAt }] : [];
    });
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
