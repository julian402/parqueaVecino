import { Injectable } from '@nestjs/common';
import type {
  AdminPayment,
  AdminPaymentListQuery,
  PaymentStatus,
  RevenueSummary,
} from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import {
  PaymentsRepository,
  type NewPayment,
  type PaymentRecord,
  type RevenueQuery,
} from '../domain/payments.repository';

const recordSelect = {
  id: true,
  bookingId: true,
  provider: true,
  providerRef: true,
  amountMinor: true,
  commissionMinor: true,
  currency: true,
  status: true,
  paidAt: true,
} satisfies Prisma.PaymentSelect;

const adminInclude = {
  booking: {
    select: {
      id: true,
      status: true,
      plate: true,
      parkingLot: { select: { name: true } },
      driver: { select: { fullName: true, email: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

interface DailyRow {
  date: string;
  gross_minor: bigint | number;
  count: bigint | number;
}

@Injectable()
export class PrismaPaymentsRepository extends PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  create(payment: NewPayment): Promise<PaymentRecord> {
    return this.prisma.payment.create({ data: payment, select: recordSelect });
  }

  findByProviderRef(providerRef: string): Promise<PaymentRecord | null> {
    return this.prisma.payment.findUnique({ where: { providerRef }, select: recordSelect });
  }

  findLatestForBooking(bookingId: string): Promise<PaymentRecord | null> {
    return this.prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      select: recordSelect,
    });
  }

  async setStatus(id: string, status: PaymentStatus, paidAt?: Date): Promise<void> {
    await this.prisma.payment.update({ where: { id }, data: { status, paidAt } });
  }

  async listForAdmin({
    page,
    pageSize,
    q,
    status,
  }: AdminPaymentListQuery): Promise<{ items: AdminPayment[]; total: number }> {
    const where: Prisma.PaymentWhereInput = {
      status,
      ...(q && {
        OR: [
          { providerRef: { contains: q, mode: 'insensitive' } },
          { booking: { plate: { contains: q, mode: 'insensitive' } } },
          { booking: { driver: { email: { contains: q, mode: 'insensitive' } } } },
          { booking: { parkingLot: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        amountMinor: row.amountMinor,
        commissionMinor: row.commissionMinor,
        currency: row.currency,
        providerRef: row.providerRef,
        createdAt: row.createdAt.toISOString(),
        booking: {
          id: row.booking.id,
          status: row.booking.status,
          plate: row.booking.plate,
          parkingLotName: row.booking.parkingLot.name,
          driverName: row.booking.driver.fullName,
          driverEmail: row.booking.driver.email,
        },
      })),
    };
  }

  async revenue({ currency, timezone, days, partnerId }: RevenueQuery): Promise<RevenueSummary> {
    const where: Prisma.PaymentWhereInput = {
      status: 'SUCCEEDED',
      currency,
      ...(partnerId && { booking: { parkingLot: { partnerId } } }),
    };
    const totals = await this.prisma.payment.aggregate({
      where,
      _sum: { amountMinor: true, commissionMinor: true },
    });

    const partnerFilter = partnerId
      ? Prisma.sql`AND l.partner_id = ${partnerId}::uuid`
      : Prisma.empty;
    // Serie diaria completa (días sin pagos en 0), agrupada en la zona horaria de la app.
    const rows = await this.prisma.$queryRaw<DailyRow[]>`
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE ${timezone})::date - (${days}::int - 1),
          (now() AT TIME ZONE ${timezone})::date,
          interval '1 day'
        )::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(p.amount_minor), 0) AS gross_minor,
             COUNT(p.id) AS count
      FROM days d
      LEFT JOIN payments p
        ON p.status = 'SUCCEEDED'
       AND p.currency = ${currency}
       -- paid_at es timestamp sin zona guardado en UTC: primero se marca UTC y luego se pasa a la zona local.
       AND ((p.paid_at AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date = d.day
       AND EXISTS (
         SELECT 1 FROM bookings b JOIN parking_lots l ON l.id = b.parking_lot_id
         WHERE b.id = p.booking_id ${partnerFilter}
       )
      GROUP BY d.day
      ORDER BY d.day
    `;

    return {
      grossMinor: totals._sum.amountMinor ?? 0,
      commissionMinor: totals._sum.commissionMinor ?? 0,
      currency,
      daily: rows.map((row) => ({
        date: row.date,
        grossMinor: Number(row.gross_minor),
        count: Number(row.count),
      })),
    };
  }
}
